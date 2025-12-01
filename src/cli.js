#!/usr/bin/env node
import { buildCommand, generateReport, generatePortfolioReport } from "./index.js";

const options = buildCommand().parse().opts();

// Check if portfolio mode is enabled
if (options.portfolioMode) {
  generatePortfolioReport(options);
} else {
  generateReport(options);
}
