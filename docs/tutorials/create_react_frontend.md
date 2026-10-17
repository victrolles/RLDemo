# How to create a React server

## Setup Node JS

**Node.js is a JavaScript runtime that executes JavaScript outside the browser.**

Install node JS using this link : [Node JS](https://nodejs.org/fr/download/current.)

Update Node JS (if already installed) :
```
winget upgrade OpenJS.NodeJS.LTS
```

Check the version
```
node --version
```

**npm (Node Package Manager) manages JavaScript packages and dependencies. It's similar to pip in Python.**

Update npm to the last version
```
npm install -g npm@latest
```

Check the version
```
npm --version
```

## Create your React project with Vite

```
npm create vite@latest frontend -- --template react-ts
```

**Select ESLint** : **linters** analyze the code to detect potential errors, bad practices, and inconsistencies without executing it.

**Use Vite** : Vite is a tool that helps you develop, run, and build frontend applications

## Start the server using Vite

```
cd frontend
npm run dev
```

## Install dependancies

```
npm install react-router-dom
```