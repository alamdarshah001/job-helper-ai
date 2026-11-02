require("dotenv").config();
const express = require("express");
const app = express();

app.use(express.json());
app.use(express.static("public"));

const multer = require("multer");
const pdfParse = require("pdf-parse");
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

async function callWithRetry(url, options, tries = 3) {
  for (let i = 0; i < tries; i++) {
    const response = await fetch(url, {
      ...options,
      signal: AbortSignal.timeout(120000),
    });
    if (response.status !== 503 || i === tries - 1) {
      return response;
    }
    await new Promise((resolve) => setTimeout(resolve, 2000 * (i + 1)));
  }
}

app.post("/extract-cv", (req, res) => {
  upload.single("cvFile")(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ error: "File 5MB se chhoti honi chahiye" });
    }
    if (!req.file) {
      return res.status(400).json({ error: "Koi file nahi mili" });
    }
    if (req.file.mimetype !== "application/pdf") {
      return res.status(400).json({ error: "Sirf PDF file upload karo" });
    }

    try {
      const data = await pdfParse(req.file.buffer);
      const text = data.text.replace(/\n{3,}/g, "\n\n").trim();

      if (!text) {
        return res.status(400).json({
          error: "PDF mein text nahi mila (shayad scanned image hai). CV ka text paste kar do.",
        });
      }

      res.json({ text });
    } catch (e) {
      console.log(e.message);
      res.status(500).json({ error: "PDF parh nahi saka" });
    }
  });
});

app.post("/analyze", async (req, res) => {
  const { cv, jobDescription } = req.body;
  console.log("1. Request aa gayi");

  if (!cv || !jobDescription) {
    return res.status(400).json({ error: "CV aur job description dono chahiye" });
  }

  const prompt = `You are a career coach. Compare the CV with the job description.
Reply ONLY with JSON in exactly this shape:
{
  "matchScore": a number from 0 to 100,
  "matchedSkills": ["skills or keywords found in both"],
  "missingSkills": ["important skills in the job description that the CV lacks"],
  "recommendations": ["5 specific improvements to the CV"],
  "coverLetter": "a short professional cover letter, under 200 words"
}

CV:
${cv}

JOB DESCRIPTION:
${jobDescription}`;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${process.env.GEMINI_MODEL}:generateContent`;
    console.log("2. Gemini ko bhej raha hun");

    const apiResponse = await callWithRetry(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": process.env.GEMINI_API_KEY,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" },
      }),
    });

    console.log("3. Gemini ka jawab aaya, status:", apiResponse.status);
    const data = await apiResponse.json();

    if (!apiResponse.ok) {
      console.log(data);
      return res.status(500).json({ error: "Server busy......" });
    }

    const parts = data.candidates?.[0]?.content?.parts || [];
    const text = parts.map((p) => p.text || "").join("");

    let report;
    try {
      report = JSON.parse(text.replace(/```json|```/g, "").trim());
    } catch (e) {
      console.log("JSON parse nahi hua:", text);
      return res.status(500).json({ error: "AI ka jawab samajh nahi aaya, dobara try karo" });
    }

    res.json({ report });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Server Issue Try Again!" });
  }
});

app.listen(3000, () => {
  console.log("Server http://localhost:3000 pe chal raha hai");
});