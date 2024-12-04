# domain-spatial-computer

## setup
1. install deno
https://docs.deno.com/runtime/getting_started/installation/

2. cp .env.example .env
3. change to desired localhost port


3. run the following command to serve:
deno --allow-read --allow-env --allow-net src/main.ts

### FOR VSCODE:
1. install deno extension
https://marketplace.visualstudio.com/items?itemName=denoland.vscode-deno

2. Cmd+Shift+P -> Deno: Initialize Workspace Configuration

## contributing
1. endpoints go in routes folder and try to match folder structure
2. add route to ./main.router.ts

3. type defs happen locally, shared types put in ./types

4. put shared functionality in utils
