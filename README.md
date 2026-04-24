# Fee Project - Shopkeeper Stock and Billing

A full-stack Node.js + Express + MongoDB app for inventory, billing, pay-later tracking, finance summaries, and bill history.

## Stack

- Frontend: HTML, CSS, vanilla JavaScript
- Backend: Node.js, Express
- Database: MongoDB Atlas

## Environment Variables

Create a `.env` file in the project root.

Use `.env.example` as a template:

- `MONGODB_URI` (required)
- `MONGODB_DB_NAME` (optional, defaults to `user`)
- `PORT` (optional, defaults to `3000`)

## Run Locally

```bash
npm install
npm run dev
```

Open:

- `http://localhost:3000`
- Health check: `http://localhost:3000/api/health`

## GitHub Push Checklist

1. Verify `.env` is ignored (already in `.gitignore`).
2. Keep secrets only in deployment environment variables.
3. Commit source files and `.env.example`.

Example:

```bash
git add .
git commit -m "Prepare app for deployment"
git branch -M main
git remote add origin <your-repo-url>
git push -u origin main
```

If `origin` already exists, use:

```bash
git remote set-url origin <your-repo-url>
git push -u origin main
```

## Deploy (Recommended: Render)

This repo includes `render.yaml`, so Render can auto-detect service settings.

1. Push this project to GitHub.
2. In Render, create a **Web Service** from the GitHub repo.
3. Configure:
   - Build command: `npm install`
   - Start command: `npm start`
4. Add environment variables in Render:
   - `MONGODB_URI`
   - `MONGODB_DB_NAME`
   - `PORT` (optional on Render; Render provides one automatically)
5. Deploy and open the generated URL.

### MongoDB Atlas Notes

- Add your deployment outbound IP or allow temporary access in Atlas Network Access.
- Create a database user with read/write permissions for your app database.
- Use the Atlas connection string in `MONGODB_URI`.

## Deployment Behavior

- `mongo-config.js` uses same-origin API (`/api`) in deployed environments.
- Local file preview (`file://`) falls back to `http://localhost:3000/api`.

## Troubleshooting

- `Database unavailable`:
  - Verify `MONGODB_URI`
  - Check Atlas IP access list
  - Check Atlas username/password
- App not loading:
  - Confirm `npm start` logs `Server running at ...`
  - Check service logs on your deployment platform

## Contributing

Contributions are welcome.

1. Fork the repo.
2. Create a feature branch.
3. Make focused changes with clear commit messages.
4. Open a pull request with a short summary and test notes.

Please do not commit secrets or `.env` files.

## License

This project is licensed under the MIT License. See the `LICENSE` file.
