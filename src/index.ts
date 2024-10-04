import { SQSClient, ReceiveMessageCommand, DeleteMessageCommand } from "@aws-sdk/client-sqs";
import { ECSClient, RunTaskCommand } from "@aws-sdk/client-ecs"
import type { S3Event } from "aws-lambda"
import dotenv from "dotenv"
dotenv.config()

const ACCESS_KEY = process.env.ACCESS_KEY!
const SECRET_ACCCESS_KEY = process.env.SECRET_ACCCESS_KEY!

const sqsClient = new SQSClient({
   region: "us-east-1",
   credentials: {
      accessKeyId: ACCESS_KEY,
      secretAccessKey: SECRET_ACCCESS_KEY,
   },
});
const ecsClient = new ECSClient({
   region: "us-east-1",
   credentials: {
      accessKeyId: ACCESS_KEY,
      secretAccessKey: SECRET_ACCCESS_KEY,
   },
})

async function init() {
   const command = new ReceiveMessageCommand({
      QueueUrl: "https://sqs.us-east-1.amazonaws.com/008971674579/VIdeoTranscoderQueue",
      MaxNumberOfMessages: 1,
      WaitTimeSeconds: 20
   })

   while (true) {
      const { Messages } = await sqsClient.send(command)
      if (!Messages) {
         console.log(`No Messages in Queue`)
         continue
      }

      try {
         for (const message of Messages) {
            const { MessageId, Body } = message
            console.log(`Message recieved`, { MessageId, Body })
            // validate & Parse the event
            if (!Body) continue

            const event = JSON.parse(Body) as S3Event
            // Ignore the test Event
            if ("Service" in event && "Event" in event) {
               if (event.Event === "s3:TestEvent") {
                  await sqsClient.send(new DeleteMessageCommand({
                     QueueUrl: "https://sqs.us-east-1.amazonaws.com/008971674579/VIdeoTranscoderQueue",
                     ReceiptHandle: message.ReceiptHandle,
                  }))
                  continue
               }
            }

            for (const record of event.Records) {
               const { s3 } = record
               const { bucket, object: { key } } = s3
               // spin up the docker container
               const runTaskCommand = new RunTaskCommand({
                  taskDefinition: "arn:aws:ecs:us-east-1:008971674579:task-definition/video-transcode",
                  cluster: "arn:aws:ecs:us-east-1:008971674579:cluster/video-transcoder-dev",
                  launchType: "FARGATE",
                  networkConfiguration: {
                     awsvpcConfiguration: {
                        assignPublicIp: "ENABLED",
                        securityGroups: ["sg-024215f38bf01561e"],
                        subnets: ["subnet-0c8b61575be694792", "subnet-03e3cf705cb95fd11", "subnet-094e50ded5939d03d", "subnet-097701f32b09266b8"]
                     }
                  },
                  overrides: {
                     containerOverrides: [{ name: "video-transcoder", environment: [{ name: "BUCKET", value: bucket.name }, { name: "KEY", value: key }] }]
                  }
               })
               ecsClient.send(runTaskCommand)

            }


            // delete the message from queue
            await sqsClient.send(new DeleteMessageCommand({
               QueueUrl: "https://sqs.us-east-1.amazonaws.com/008971674579/VIdeoTranscoderQueue",
               ReceiptHandle: message.ReceiptHandle,
            }))
         }
      } catch (error) {
         console.log("Error", error)
      }

   }
}
init()