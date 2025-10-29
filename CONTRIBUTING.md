# 🤝 Contributing

We welcome contributions!
Here’s how to get started:

1. **Fork** the repository
2. **Create a feature branch**

   ```bash
   git checkout -b feat/your-feature-name
   ```
3. **Commit your changes**

   ```bash
   git commit -m "feat: add user matchmaking"
   ```
4. **Push to your branch**

   ```bash
   git push origin feat/your-feature-name
   ```
5. **Open a Pull Request**

## Coding Guidelines

 **Language & Style**
  * Use **TypeScript** consistently (frontend & backend).
  * File name **must** be consistent, use the **category** as a suffix before the extension to indicate the file’s purpose if necessary
	* (`.route.ts`, `.test.ts`, `.schema.ts`...)
  * Prefer **descriptive variable and function names**.
  * Keep functions small and single-purpose.
  * Use consistent **indentation** and **code formatting** (Prettier/ESLint recommended).

* **Branch & Commit Naming**
  * Branches: `feat/`, `fix/`, `task/`, `docs/`.
    * Example: `feature/user-auth`, `fix/socket-bug`.
  * Commits: follow **conventional commits**:
    * `feat:` for new features
    * `fix:` for bug fixes
    * `task:` for maintenance tasks
    * `docs:` for documentation updates
  * Keep commit messages **clear and concise**.
	* it's recommended to add a description if necessary

* **Pull Requests**
  * Make PRs **small and focused**.
  * Provide a **short description** of what the PR does and why.
  * Link related issues if any.

* **Testing**
  * Add **unit tests** for critical logic.
	* tests must be located in `backend/tests/` with the same file structure as `src`
	* Files **must be named** after the **file** tested like this: `<filename>.test.ts`
   
  * **Run tests locally before opening a PR**:
  
    ```bash
    npm run test
    ```

* **Code Review**
  * Be open to feedback.
  * Ensure all code follows the project style guide.

## Documenting API Endpoints
When adding or updating **API endpoints**, it is essential to provide clear and complete documentation for both developers and automated tools like Swagger/OpenAPI. Follow these guidelines:
### 1. Use Consistent Schema Files

- Create a dedicated schema file for each endpoint under `src/plugins/swagger/schemas/`.
- Name the file using the pattern: `<endpoint>.schema.ts`.

Export the schema as a constant, for example:
```ts
export const exampleSchema = {
  summary: "An example",
  description: "This is a schema to use as an example",
  tags: ["Users"],
  querystring: {
    type: "object",
    required: ["id"],
    properties: {
      code: { type: "string", description: "An id to retrieve something" }
    }
  },
  response: {
    200: {
      description: "Something related to the id",
      type: "string"
    },
    400: {
		description: "Missing or invalid id",
		type: "string"
	},
    404: {
		description: "It was not found",
		type: "string"
	},
    500: {
    	description: "Internal error",
		type: "string"
    }
  }
};
```

### 2. Attach Schema to Route
- When registering your route with Fastify, attach the schema using the `schema` option:
```ts
fastify.get('/somewhere', {
  schema: exampleSchema,
  validatorCompiler: ({ schema }) => () => true // optional if you skip validation
}, async (request, reply) => {
  // route logic
});
```

### 3. Best Practices

-  **Summary and description**: Clearly explain the endpoint’s purpose and what it does.
- **Query parameters**: List required and optional parameters with types and descriptions.
- **Responses**: Document all possible status codes, response types, and error messages.
- **Consistency**: Use the same tags for endpoints in the same category (e.g., `Auth: OAuth`) to group them in Swagger.
- **Example values**: Whenever possible, provide example values for responses and errors.

## Communication Guidelines

- Be respectful and concise.
- Avoid harsh language or public blaming.
- Discuss large changes or architecture decisions in an issue first before implementing.
- Respond to comments on PRs within a reasonable timeframe.

Thank you for contributing to ft_transcendence! Your work makes this project better and stronger.