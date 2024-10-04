const {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
} = require("@aws-sdk/client-s3");
const fs = require("node:fs/promises");
const ffmpeg = require("fluent-ffmpeg");
const path = require("node:path");

const client = new S3Client({
  region: "us-east-1",
});
const RESOLUTIONS = [
  { name: "144p", width: 256, height: 144 },
  { name: "240p", width: 426, height: 240 },
  { name: "360p", width: 480, height: 360 },
  { name: "480p", width: 858, height: 480 },
  { name: "720p", width: 1280, height: 720 },
];

const KEY = process.env.KEY;
const BUCKET = process.env.BUCKET;

function generateUniqueId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

function getFileNameWithoutExtension(filePath) {
  return path.basename(filePath, path.extname(filePath));
}

async function init() {
  // Download the video
  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: KEY,
  });

  const result = await client.send(command);
  const video = "original.mp4";
  await fs.writeFile(video, result.Body);
  const originalpath = path.resolve(video);

  const uniqueId = generateUniqueId();
  const originalFileName = getFileNameWithoutExtension(KEY);

  // Transcode the video
  const promises = RESOLUTIONS.map((resolution) => {
    const outputpath = `${originalFileName}-${resolution.name}-${uniqueId}.mp4`;
    return new Promise((resolve, reject) => {
      ffmpeg(originalpath)
        .output(outputpath)
        .withVideoCodec("libx264")
        .withAudioCodec("aac")
        .withSize(`${resolution.width}x${resolution.height}`)
        .format("mp4")
        .on("start", () => {
          console.log(`start ${resolution.width}x${resolution.height}`);
        })
        .on("end", async () => {
          try {
            const fileContent = await fs.readFile(outputpath);
            const putCommand = new PutObjectCommand({
              Bucket: "transcided-videos-adityasahani.com",
              Key: `transcoded/${outputpath}`,
              Body: fileContent,
            });
            await client.send(putCommand);
            console.log(`Uploaded file ${outputpath}`);
            resolve();
          } catch (error) {
            console.error(`Error uploading file ${outputpath}:`, error);
            reject(error);
          }
        })
        .on("error", (err) => {
          console.error(`Error processing ${resolution.name}:`, err);
          reject(err);
        })
        .run();
    });
  });

  try {
    await Promise.all(promises);
    console.log("All videos processed and uploaded successfully");
  } catch (error) {
    console.error("Error processing videos:", error);
  }
}

init();
