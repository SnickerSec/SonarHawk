# 📊 SonarFlex

> An enhanced fork of [sonar-report](https://github.com/soprasteria/sonar-report) that provides modern vulnerability reporting for SonarQube.

![Version](https://img.shields.io/github/v/release/cwills/sonarflex)
![Build](https://img.shields.io/github/workflow/status/cwills/sonarflex/CI)
![Coverage](https://img.shields.io/codecov/c/github/cwills/sonarflex)
![License](https://img.shields.io/github/license/cwills/sonarflex)
![Node](https://img.shields.io/node/v/sonarflex)
![Dependencies](https://img.shields.io/librariesio/github/cwills/sonarflex)

<p align="center">
  <img src="screenshots/report.png" alt="SonarFlex Report Example" width="800"><br/>
  <em>Enhanced vulnerability reporting with modern UI and advanced features</em>
</p>

## Key Features Over sonar-report

| Feature           | sonar-report | SonarFlex  |
| ----------------- | ------------ | ---------- |
| SonarQube Support | ≤ 7.9        | Up to 10.x |
| PDF Export        | ❌           | ✅         |
| Modern UI         | Basic        | Enhanced   |
| Quality Gates     | Basic        | Detailed   |
| Issue Tracking    | Basic        | Enhanced   |
| Hotspot Support   | Limited      | Full       |
| Delta Analysis    | Limited      | Full       |
| Debug Mode        | ❌           | ✅         |
| Proxy Support     | Basic        | Advanced   |
| Custom Templates  | Basic        | Full EJS   |

## Quick Start

```bash
# Installation
npm install -g sonarflex

# Basic Usage
sonarflex \
  --sonarurl="https://sonar.company.com" \
  --sonarcomponent="project-key" \
  --sonartoken="your-token" \
  --output="report.html"
```

## 📖 Documentation

### Essential Configuration

```bash
# Authentication (Token - Recommended)
sonarflex --sonartoken="your-token"

# Authentication (Username/Password)
sonarflex --sonarusername="user" --sonarpassword="pass"

# Branch Analysis
sonarflex --branch="feature/new-auth"

# Quality Gates
sonarflex --quality-gate-status --coverage
```

### Report Customization

```bash
# Custom Template
sonarflex --ejs-file="template.ejs"

# Custom Styling
sonarflex --stylesheet-file="custom.css"

# Custom Labels
sonarflex \
  --vulnerability-phrase="Security Issue" \
  --vulnerability-plural-phrase="Security Issues"
```

## 🔧 Configuration Options

### Required Options

| Option             | Description   | Default |
| ------------------ | ------------- | ------- |
| `--sonarurl`       | SonarQube URL | -       |
| `--sonarcomponent` | Project key   | -       |
| `--sonartoken`     | Auth token    | -       |
| `--output`         | Report path   | -       |

### Analysis Options

| Option                  | Description       | Default |
| ----------------------- | ----------------- | ------- |
| `--branch`              | Branch to analyze | main    |
| `--in-new-code-period`  | Delta analysis    | false   |
| `--allbugs`             | Include all bugs  | false   |
| `--no-security-hotspot` | Disable hotspots  | false   |

### Visualization Options

| Option                  | Description        | Default |
| ----------------------- | ------------------ | ------- |
| `--quality-gate-status` | Show quality gates | false   |
| `--coverage`            | Show coverage      | false   |
| `--link-issues`         | Link to SonarQube  | false   |
| `--no-rules-in-report`  | Hide rules section | false   |

## 🛠️ Advanced Features

### Delta Analysis

Track changes between versions:

```bash
sonarflex \
  --in-new-code-period \
  --branch="feature/new-auth"
```

### Quality Gate Status

Include detailed quality metrics:

```bash
sonarflex \
  --quality-gate-status \
  --coverage
```

### Custom Report Styling

```bash
sonarflex \
  --stylesheet-file="custom.css" \
  --ejs-file="template.ejs"
```

## 🔍 Debugging

Enable detailed logging:

```bash
sonarflex --debug
```

Debug output includes:

- API requests/responses
- Authentication process
- Template rendering
- File operations

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open Pull Request

## 📄 License

MIT License - see [LICENSE](LICENSE) for details

## 🙏 Acknowledgments

- Original [sonar-report](https://github.com/soprasteria/sonar-report) team
- [SonarQube](https://www.sonarqube.org/) team for their excellent API
- Community contributors and users

---

<p align="center">Made with ❤️ by the SonarFlex Team</p>
