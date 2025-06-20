# Tunnel Module Overview

This module is one of the core components of the communication subsystem. It is responsible for facilitating messaging and relaying between nodes via a unified message-based mechanism.

## Module Structure

### TunnelService

Handles core communication logic between nodes, including:

- Sending and receiving messages (both income and outcome directions)
- Registering and triggering message listeners
- Determining the message direction and dispatching to the appropriate handler



To function properly, it relies on two internal components: MessageGateway and MessageHandler.

### MessageGateway

Acts as the external communication interface. The Gateway serves as the ingress and egress point for the Tunnel, simulating network-layer behavior.

- Responsible for sending and receiving messages
- In test environments, a MockedMessageGateway is used to simulate communication

### MessageHandler

Handles messages of a specific type. Each handler is automatically registered based on the message’s type and direction, and triggered upon receiving a message.



## Message Sending & Receiving Workflow

The general message flow inside the Tunnel system is as follows:

##### Communication Flow Example: Tunnel A <-> Tunnel B

```
Sender Node A:
Prepare message -> OutcomeMessageHandler -> TunnelService.sendMessage() -> MessageGateway.send()

Receiver Node B:
MessageGateway.receive() -> TunnelService.handleMessage() -> IncomeMessageHandler -> Process message
```

When sending a message, the TunnelService determines its direction based on the `peerId`, and routes it through the appropriate logic branch (income or outcome).

### Writing a Message Handler

You can define a handler using the custom `@MessageHandler` decorator. This enables automatic registration without needing manual configuration.

##### Example

```ts
@MessageHandler({ type: 'context-ping', direction: 'outcome' })
@Injectable()
export class OutcomeContextPingMessageHandler extends OutcomeBaseMessageHandler {
  constructor(
    @Inject('TunnelService') private readonly tunnel: TunnelService,
    @Inject('PEER_ID') protected override readonly peerId: string,
  ) {
    super(peerId);
  }

  async handleOutcomeMessage(message: TunnelMessage): Promise<void> {
    const pingMessage = ContextPingMessageSchema.parse(message);
    this.tunnel.sendMessage(pingMessage);
  }
}
```

You can find more examples under the `message-handler` directory.

##### Conventions for Writing Handlers

- Each handler must be decorated with `@MessageHandler` and specify both type and direction.
  - `type` refers to the message service type and should align with definitions in `tunnel-message.schema.ts`.
  - `direction` must be either income or outcome.
- Handlers should extend either `IncomeBaseMessageHandler` or `OutcomeBaseMessageHandler` and implement necessary methods.

## Listener Mechanism

The Tunnel module supports attaching listeners for asynchronous message tracking. This is particularly useful for request-response patterns.

### Listener Object Structure

A listener is an object that defines matching and callback logic:

```ts
export interface TunnelMessageListener {
  match: (msg: TunnelMessage) => boolean;
  callback: (msg: TunnelMessage) => void;
  once?: (msg: TunnelMessage) => boolean;
}
```

- `match`: A predicate function used to filter messages (typically by type or requestId)
- `callback`: Executed when a matching message is received (e.g., to update UI, record timing)
- `once`: If true, the listener will be automatically removed after being triggered once; otherwise, it will persist

#### Adding a Listener

You can attach a listener when calling `TunnelService.handleMessage()`:

```ts
const listener = ({
  match: (msg) => msg.type === 'context-pong' && msg.payload.requestId === requestId,
  callback: (msg) => {
    const sendTime = originalMessage.payload.timestamp;
    const rtt = Date.now() - sendTime;
    console.log(`RTT = ${rtt}ms`);
  },
  once: () => true
});

tunnel.handleMessage(msg, listener);
```

The listener will be triggered upon receiving a `context-pong` message that matches the requestId.

### Listener Execution Flow

1. A message is sent using `tunnel.handleMessage(msg, listener)`.
2. The listener is registered internally.
3. When the response message is received, TunnelService checks all registered listeners before invoking any message handlers.
4. If a match is found:
   - The listener’s callback is executed.
   - If once returns true, the listener is removed from the registry.

