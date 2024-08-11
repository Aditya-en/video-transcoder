import { SQSClient, ReceiveMessageCommand } from "@aws-sdk/client-sqs";
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
               if (event.Event === "s3:TestEvent") continue
            }

            for (const record of event.Records) {
               const { s3 } = record
               const { bucket, object: { key } } = s3
               // spin up the docker container

            }


            // delete the message from queue
         }
      } catch (error) {
         console.log("Error", error)
      }

   }
}
init()