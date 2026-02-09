# Contributing to Zenmanage JavaScript SDK

Thank you for your interest in contributing to the Zenmanage JavaScript SDK! We welcome contributions from the community.

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/your-username/zenmanage-javascript.git`
3. Install dependencies: `npm install`
4. Create a branch: `git checkout -b feature/your-feature-name`

## Development

### Building

```bash
npm run build
```

### Testing

```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Linting

```bash
# Check for linting errors
npm run lint

# Fix linting errors
npm run lint:fix
```

### Type Checking

```bash
npm run type-check
```

### Formatting

```bash
# Check formatting
npm run format:check

# Fix formatting
npm run format
```

## Code Style

- Use TypeScript for all source code
- Follow the existing code style (enforced by ESLint and Prettier)
- Write meaningful commit messages
- Add tests for new features
- Update documentation as needed

## Testing Guidelines

- Write unit tests for all new functionality
- Maintain or improve test coverage
- Tests should be deterministic and isolated
- Mock external dependencies (API calls, filesystem, etc.)

## Pull Request Process

1. Ensure all tests pass: `npm test`
2. Ensure code is formatted: `npm run format`
3. Ensure no linting errors: `npm run lint`
4. Ensure TypeScript compiles: `npm run type-check`
5. Update README.md if needed
6. Update CHANGELOG.md with your changes
7. Create a pull request with a clear description

## Reporting Issues

- Use GitHub Issues to report bugs
- Include a clear description of the issue
- Provide steps to reproduce
- Include relevant code snippets or error messages
- Specify your environment (Node.js version, browser, etc.)

## Code of Conduct

Please be respectful and constructive in all interactions. We're all here to learn and improve the SDK.

## Questions?

If you have questions, feel free to:
- Open a GitHub Discussion
- Create an issue
- Contact us at support@zenmanage.com

Thank you for contributing! 🎉
