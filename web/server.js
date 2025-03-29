import express from 'express';
import cors from 'cors';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { readFile, unlink } from 'fs/promises';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');

// Import main project file
const { generateReport } = await import('../index.js');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors({
  origin: 'http://localhost:5173', // Allow Vite dev server
  credentials: true
}));
app.use(express.json());

// Add health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.post('/api/generate', async (req, res) => {
  try {
    process.chdir(projectRoot);
    
    // Create temporary file path for report
    const tempOutput = resolve(projectRoot, 'temp-report.html');
    
    // Add output path to options
    const options = {
      ...req.body,
      darkTheme: req.body.darkTheme === true,
      output: tempOutput
    };

    await generateReport(options);
    
    // Read generated file and send it
    const reportHtml = await readFile(tempOutput, 'utf8');
    res.setHeader('Content-Type', 'text/html');
    res.send(reportHtml);
    
    // Clean up temp file
    await unlink(tempOutput).catch(console.error);
    
  } catch (error) {
    console.error('Report generation failed:', error);
    res.status(500).json({
      error: error.message || 'Failed to generate report'
    });
  }
});

app.listen(port, () => {
  console.log(`API server running on port ${port}`);
});