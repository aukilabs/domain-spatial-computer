# domain-spatial-computer

##setup
1. install deno
https://docs.deno.com/runtime/getting_started/installation/

2. cp .env.example .env
2.1 change to desired localhost port

3. run the following command to serve:
deno --allow-read --allow-env --allow-net src/main.ts

##contributing
1 endpoints go in routes folder and try to match folder structure
1.1 add route to ./main.router.ts

2. type defs happen locally, shared types put in ./types

3. put shared functionality in utils
