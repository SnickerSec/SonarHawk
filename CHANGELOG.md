# Changelog

## [1.1.1] - 2025-03-28

### Security

- Fixed potential regex DOS vulnerability in URL handling
- Added safe-regex package for improved security

### Fixed

- Improved caching implementation with normalized keys
- Enhanced error handling for network requests
- Fixed branch name validation in version check workflow

## [1.1.0] - 2025-03-28

### Changed

- Dark theme is now the default theme
- Theme selection via `--light-theme` flag
- Improved HTML report template contrast and accessibility
- Enhanced PDF export styling

### Added

- Automated GitHub release workflow
- Version sync check for PRs
- Release template for consistent releases
- Additional debug logging for theme detection

## [1.0.0] - 2024-02-19

### Added

- Initial release of SonarHawk
- Support for SonarQube up to version 10.x
- Modern UI with light and dark themes
- PDF export functionality
- Enhanced quality gates reporting
- Full security hotspot support
- Delta analysis capabilities
- Proxy support with automatic detection
- Debug mode for troubleshooting
- Customizable templates using EJS
- Accessibility improvements
- Print-friendly formatting

### Theme Features

- Light theme (default) for optimal daytime use
- Dark theme for reduced eye strain
- Automatic theme switching for printing
- Enhanced link visibility in dark mode
- High contrast severity indicators

### Technical Improvements

- ES Module support
- Improved error handling
- Better proxy configuration
- Enhanced API pagination
- Configurable report templates
- Custom styling support
