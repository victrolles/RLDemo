# How to locally orchestrate a small project (using Concurrently)

For the complete Python environment and dependency setup, see the [project installation guide](../../README.md#installation). The API command below uses the Windows `.venv` path.

## Installation

At the root of the repo
```sh
npm install --save-dev concurrently
```

## Configure package.json

```json
{
  "name": "rldemo",
  "private": true,
  "scripts": {
    "dev": "concurrently --kill-others -n API,WEB -c blue,green \"npm:dev:api\" \"npm:dev:web\"",
    "dev:api": ".\\.venv\\Scripts\\python.exe -m uvicorn server.app:app --reload --host 127.0.0.1 --port 8000",
    "dev:web": "npm run dev --prefix frontend",
    "build": "npm run build --prefix frontend",
    "lint": "npm run lint --prefix frontend",
    "test:api": ".\\.venv\\Scripts\\python.exe -m unittest discover -s tests -v"
  },
  "devDependencies": {
    "concurrently": "^10.0.6"
  }
}
```

* dev:api lance Uvicorn depuis le bon répertoire, avec le rechargement automatique du code Python.
* dev:web lance Vite dans frontend/.
* dev lance les deux processus simultanément, et --kill-others arrête l'autre si l'un se termine.
* build, lint et test:api offrent des commandes communes au projet.

## Start the project

```sh
npm run dev
```
