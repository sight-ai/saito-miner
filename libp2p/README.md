# How to start

## Project setup

```bash
$ pnpm install

# copy .env.example to .env
$ cp .env.example .env
```

## Compile and run the project

```bash
# build
$ pnpm run build

# development
$ pnpm run start

# or run directly in dev modle
$ pnpm run start:dev
```

### 确保先跑起来client，再跑libp2p (当前有devicedId检测)
