# Solid VC Module

## Installation
```
npm install
```

## .env
Take a look at the [.env.example](./.env.example).


## Run
```
npx ts--node src/index.ts
```

## Docker
Or use docker with the provided Dockerfile.

```
sudo docker build -t solid-vc-module:latest .
sudo docker run -d --name solid-vc-module solid-vc-module:latest
```
