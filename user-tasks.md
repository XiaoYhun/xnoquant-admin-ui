## Purpose

I will write down tasks here, you do them whenever you have free time or got blocked, bring in subagents to help. Have another md file to track progress.

## Tasks
- On click use template, open a confirmation modal
- The Results tab, they should have 2 versions: 
    - MFT: this design @https://www.figma.com/design/B7Hh2GpERHUPyy3Zdv35sY/XNO-QUANT-AI?node-id=13964-56918&m=dev
        - It is completely same with Results tab in xno-builder page
    - HFT: which is current implementation, leave it for now
- On user click Plus button with HFT selected: call this api POST https://hft-dev.xnoquant.io/api/strategies
- Try to run call GET https://hft-dev.xnoquant.io/api/strategies and merge to the Editors list. Let me know if it works or any difficult
- On user click Plus button with MFT selected: call the API create editor and revalidate editors list after done 
- For MFT strategy, copy the Simulate flow from xno-builder
- Add a API call auth/me and put it somewhere so I can check it in browser. As we will need to use user roles later 
- Console logic should match one in xno-builder
- Settings dropdown of MFT also different, get it from xno-builder
## Bugs
- Expanded Sample description did not show full
- Only open Simulate modal for HFT strategies, which is no any right now but keep the logic, MFT just show nothing and call direct to api to submit. 
- Update styling of scrollbar from xno-builder
- Input Name and choose MFT option, then create, the new created strategy dont have that name
- On x click in Editors list, should call the editor Delete api
- The HFT dot beside Strategy name, should be green one, not purple