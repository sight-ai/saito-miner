FROM --platform=linux/amd64 node:20.18.3

RUN apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

# RUN curl -fsSL https://ollama.com/install.sh | sh
RUN apt-get update && apt-get install -y supervisor

COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

EXPOSE 8716
WORKDIR /
COPY .env /

WORKDIR /dist/packages/
COPY ./dist/packages/ .

# WORKDIR /dist/packages/apps/api-server

ENV NODE_DATABASE_URL="postgres://postgres:postgres@sight-miner-postgres:5432/saito_db"
ENV OLLAMA_DEVICE_ID="ollama-1"
ENV OLLAMA_MODEL="deepscaler"
ENV OLLAMA_DEVICE_NAME="Sight AI Server"
ENV OLLAMA_API_URL="http://host.docker.internal:11434/"


# RUN npm cache clean --force
RUN npm i
# RUN ollama serve & \
#     sleep 5 && \
#     ollama pull deepscaler


CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]




