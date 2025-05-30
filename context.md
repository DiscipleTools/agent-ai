## Context
This is a node server. It will be used in collobaration with a chatwoot instance.
This server will implement sereval AI agents. Agents will respond to user chats and emails.

When a new message comes in, chatwoot will fire a webhook. Each agent will have its own webhook.

This Agent server has
- User authentication and management
- Agent creation and Management
- Agents connected to AI to respond to conversations


## Authentication
This server allows for user to sign in but not register.
Users can be invited to join the server.
Users can create agents and edit agents they have access to.

## Admin User Management UI
Only Users with Admin priviledges can access the User Management UI
Admins can invite, edit and remove users.
Admins can select wich agents the users have access to.

## Agent Management
An agent is customized with a prompt.
An agent can be given urls or files to expand the agent context.
List out the agent's webhook for copying.

## Agent Capabilities
An agent will receive a text message, email or conversation.
The agent will use its context, prompt and the provided conversation to respond to the conversation with the next message.
The agent will use AI (specifically using the https://predictionguard.com/ api ) to respond to conversations


## Server Settings
Settup the Prediction Guard AI endpoint and the API key.

