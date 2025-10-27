# 🤝 Contributing

We welcome contributions!
Here’s how to get started:

1. **Fork** the repository
2. **Create a feature branch**

   ```bash
   git checkout -b feature/your-feature-name
   ```
3. **Commit your changes**

   ```bash
   git commit -m "feat: add user matchmaking"
   ```
4. **Push to your branch**

   ```bash
   git push origin feature/your-feature-name
   ```
5. **Open a Pull Request**

### Coding Guidelines

* **Language & Style**
  * Use **TypeScript** consistently (frontend & backend).
  * Prefer **descriptive variable and function names**.
  * Keep functions small and single-purpose.
  * Use consistent **indentation** and **code formatting** (Prettier/ESLint recommended).

* **Branch & Commit Naming**
  * Branches: `feature/`, `fix/`, `chore/`, `docs/`.
    * Example: `feature/user-auth`, `fix/socket-bug`.
  * Commits: follow **conventional commits**:
    * `feat:` for new features
    * `fix:` for bug fixes
    * `chore:` for maintenance tasks
    * `docs:` for documentation updates
  * Keep commit messages **clear and concise**.

* **Pull Requests**
  * Make PRs **small and focused**.
  * Provide a **short description** of what the PR does and why.
  * Link related issues if any.

* **Testing**
  * Add **unit tests** for critical logic.
  * Run tests locally before opening a PR:
  
    ```bash
    npm run test
    ```

* **Code Review**
  * Be open to feedback.
  * Ensure all code follows the project style guide.
