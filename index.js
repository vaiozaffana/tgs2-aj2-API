const express = require("express");
const multer = require("multer");
const dotenv = require("dotenv");
const fs = require("fs");
const path = require("path");
const { GoogleGenerativeAI } = require("@google/generative-ai");

dotenv.config();
const app = express();
app.use(express.json());

const genAi = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAi.getGenerativeModel({ model: "models/gemini-2.5-flash" });

const upload = multer({ dest: "uploads/" });

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server started on http://localhost:${PORT}`);
});

app.use("/generate-text", async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) {
      return res.status(400).send("No prompt provided");
    }
    const result = await model.generateContent(prompt);
    const response = await result.response;
    res.json({ output: response.text() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function imageToGenerativePart(imagePath) {
  return {
    inlineData: {
      data: Buffer.from(fs.readFileSync(imagePath)).toString("base64"),
      mimeType: "image/jpeg",
    },
  };
}

app.post("/generate-from-image", upload.single("image"), async (req, res) => {
  const prompt = req.body.prompt || "Describe the image";
  const image = imageToGenerativePart(req.file.path);

  try {
    const result = await model.generateContent([prompt, image]);
    const response = await result.response;
    res.json({ output: response.text() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    fs.unlinkSync(req.file.path, (err) => {
      if (err) {
        console.error("Error deleting temporary file:", err);
      }
    });
  }
});

app.post(
  "/generate-from-document",
  upload.single("document"),
  async (req, res) => {
    const filePath = req.file.path;
    const buffer = fs.readFileSync(filePath);
    const base64Data = buffer.toString("base64");
    const mimeType = req.file.mimetype;

    try {
      const documentPart = {
        inlineData: { data: base64Data, mimeType },
      };

      const result = await model.generateContent([
        "Analyze this document:",
        documentPart,
      ]);
      const response = await result.response;
      res.json({ output: response.text() });
    } catch (err) {
      res.status(500).json({ error: err.message });
    } finally {
      fs.unlinkSync(filePath, (err) => {
        if (err) {
          console.error("Error deleting temporary file:", err);
        }
      });
    }
  }
);

app.post("/generate-from-audio", upload.single("audio"), async (req, res) => {
  const audioBuffer = fs.readFileSync(req.file.path);
  const base64Audio = audioBuffer.toString("base64");
  const audioPart = {
    inlineData: {
      data: base64Audio,
      mimeType: req.file.mimetype,
    },
  };

  try {
    const result = await model.generateContent([
      "Transcribe the following audio:",
      audioPart,
    ]);
    const response = await result.response;
    res.json({ output: response.text() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    fs.unlinkSync(req.file.path, (err) => {
      if (err) {
        console.error("Error deleting temporary file:", err);
      }
    });
  }
});
