const {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
} = require("@aws-sdk/client-s3");
const fs = require("node:fs/promises");
const ffmpeg = require("fluent-ffmpeg");
const path = require("node:path");

const client = S3Client({
  region: "us-east-1",
});
const RESOLUTIONS = [
  { name: "360p", width: 480, height: 360 },
  { name: "360p", width: 858, height: 480 },
  { name: "360p", width: 1280, height: 720 },
];

const KEY = process.env.KEY;
const BUCKET = process.env.BUCKET;

async function init() {
  // Download the video
  const command = GetObjectCommand({
    Bucket: BUCKET,
    Key: KEY,
  });

  const result = await client.send(command);
  const video = "original.mp4";
  await fs.writeFile(video, result.Body);
  const originalpath = path.resolve(video);
  // Transcode the video
  const promises = RESOLUTIONS.map((resolution) => {
    const outputpath = `transcoded/video-${resolution.name}.mp4`;
    return new Promise((resolve) => {
      ffmpeg(originalpath)
        .output(outputpath)
        .withVideoCodec("libx256")
        .withAudioCodec("acc")
        .withSize(`${resolution.width}x${resolution.height}`)
        .format("mp4")
        .on("end", async () => {
          const putCommand = new PutObjectCommand({
            Bucket: "transcided-videos-adityasahani.com",
            Key: outputpath,
          });
          client.send(putCommand);
          console.log(`Uploaded file ${outputpath}`);
          resolve();
        })
        .run();
    });
  });
  await Promise.all(promises);
}

init().finally(() => process.exit(0));
