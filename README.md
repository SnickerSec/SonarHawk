# SonarFlex

![Project Overview](image-1.png)

## Overview

**SonarFlex** is a powerful fork of sonar-report that enhances vulnerability reports from your SonarQube instance with improved visuals and functionality. Customize your reports and analyze data with ease across different SonarQube versions.

## Installation

- **Requirements**: Node.js v14+
  
To install globally, run:

```bash
npm install -g sonar-report
```

## Usage

SonarFlex can generate reports with various configurations. To view all available options, run:

```bash
sonar-report -h
```

This will display:

```plaintext
Usage: sonar-report [options]

Generate a vulnerability report from a SonarQube instance.
```

### Environment Variables

- **http_proxy**: Proxy to connect to SonarQube (`http://<host>:<port>`)
- **NODE_EXTRA_CA_CERTS**: Custom certificate authority file for SSL verification (PEM format)

### Example Command

Generate a report:

```bash
sonar-report \
  --sonarurl="https://sonarcloud.io" \
  --sonarcomponent="soprasteria_sonar-report" \
  --sonarorganization="sopra-steria" \
  --project="Sonar Report" \
  --application="sonar-report" \
  --release="1.0.0" \
  --branch="master" \
  --output="samples/sonar-report_sonar-report.html"
```

To open the report in your browser:

```bash
xdg-open samples/sonar-report_sonar-report.html
```

## Migrating to v3

### Key Changes

- **Flag Changes**: Most flags now use kebab-case.
- **Output Folder**: Use the `--output` flag to specify a folder for the generated report. This enables viewing summaries directly in CI pipelines.

Example summary format:

```plaintext
Report Generated On Wed Aug 24 2022

Project Name: Sonar Report
Application: sonar-report
Release: 1.0.0
Delta analysis: No

Summary of the Detected Vulnerabilities

Severity: HIGH
Number of Issues: 0

Severity: MEDIUM
Number of Issues: 0

Severity: LOW
Number of Issues: 0
```

## Key Parameters

### `--since-leak-period`

Enables delta analysis. If set to `true`, only vulnerabilities added since a specific date/version or within a set number of days are shown.

This option:

1. Retrieves `sonar.leak.period` from SonarQube settings.
2. Filters issues by this period.

More information on [SonarQube’s leak period](https://docs.sonarqube.org/latest/user-guide/fixing-the-water-leak/).

### `--allbugs`

- **"false"**: Only vulnerabilities are included.
- **"true"**: Includes all bugs.

### `--fix-missing-rule`

Handles discrepancies in issue types (`VULNERABILITY` vs `CODE_SMELL`) across different SonarQube versions.

Activating this parameter:

- Ensures rules are extracted even when types don’t align.
- May result in additional issues being included.

### `--no-security-hotspot`

Disables hotspot processing, which varies by SonarQube version. Use this option if your instance doesn’t fully support hotspots.

#### Hotspot Support by SonarQube Version:

- **< 7.3**: No support for hotspots.
- **7.3 - 7.8**: Hotspots stored in `/issues` endpoint; some statuses unavailable.
- **7.8 - 8.2**: Hotspots fully supported in `/issues`.
- **>= 8.2**: Hotspots moved to `/hotspots` endpoint.

To check your instance’s behavior:

- View `api/system/status` for version info.
- Check `/web_api/api/issues/search` and `/web_api/api/rules/search` for parameter options.

## Development

To set up for development, install dependencies:

```bash
npm install
```

Then, run commands like in the [Usage](#usage) section but replace `sonar-report` with `node cli.js`.

## Troubleshooting

### Common Issues

- **Missing Rule Descriptions**: Use `--fix-missing-rule` to fetch all rules.
- **400 Bad Request for Hotspot Types**: If your SonarQube instance doesn’t support hotspots, use `--no-security-hotspot`.
- **Too Many Results**: SonarQube limits results to 10,000. Use filters or remove `--allbugs` if needed.

## Additional Notes

Refer to SonarQube’s documentation and your instance’s API documentation for details on available settings:

- **Status**: `${sonarBaseURL}/api/system/status`
- **Issues**: `${sonarBaseURL}/web_api/api/issues/search`
- **Rules**: `${sonarBaseURL}/web_api/api/rules/search`
- **Hotspots**: `${sonarBaseURL}/web_api/api/hotspots`

## Application Improvements Summary:

| Feature                       | Improvement                                                                 |
|-------------------------------|-----------------------------------------------------------------------------|
| Report Layout                 | Redesigned for improved readability and visual appeal.                      |
| Sectioned UI                  | Clear sections for Summary, Quality Gate Status, and Detailed Vulnerabilities. |
| Severity-Based Color Coding    | Color-coded badges for quick identification of critical issues.             |
| Responsive Tables             | Improved handling of overflow and horizontal scrolling.                     |
| Download and Export Options   | Export to PDF and print functionality.                                    |
| Interactive Features          | Alt text for images, improved link styling, and tooltips.                  |
| Consistent Iconography        | Standardized icons for a cohesive look.                                     |
| Improved Error Handling       | Clearer error messages and troubleshooting suggestions.                     |
| Code Refactoring and Modularity | Improved code organization for easier maintenance.                           |

