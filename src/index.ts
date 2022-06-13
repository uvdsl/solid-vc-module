import "dotenv/config";
import { w3cwebsocket as WebSocket } from "websocket";
import { SolidNodeClient } from "solid-node-client";
import { parseToN3 } from "./lib/parse";
import { LDP } from "./lib/namespaces"
import { verifyBBS } from "./lib/bbs";
import { getPersonalData } from "./lib/queries"


async function main() {
  const inbox = process.env.SOLID_WP_INBOX;
  console.log("### INFO  \t| Inbox set.");

  const client = new SolidNodeClient();
  const unauthenticated = new SolidNodeClient();
  const session = await client.login({
    idp: process.env.SOLID_IDP,
    username: process.env.SOLID_USERNAME,
    password: process.env.SOLID_PASSWORD,
  });

  console.log("### INFO  \t| SOLID set.");
  console.log({
    idp: process.env.SOLID_IDP,
    username: process.env.SOLID_USERNAME,
  });
  console.log("LoggedIn:", session.isLoggedIn);

  let res = "https://ik1533.solid.aifb.kit.edu/conf/pidkg/demo"
  let ldns = [];
  const knownLDNs = []




  async function checkCred(req: Object) {
    const cred = req["cred:vc"]
    const verified = await verifyBBS(cred, true)
    if (!verified.verified) return [req, "### ERR  \t| Credential not verified."]
    if (!cred["credentialSubject"]["visitedPFCdemo"]) return [req, ("### ERR  \t| Credential verified but required attribute missing.")]
    console.log("### INFO  \t| Credential verified.");
    return [req, undefined]
  }


  async function exec() {
    await client.fetch(inbox, {
      headers: { Accept: "text/turtle,application/ld+json" },
    })
      .then((resp) => resp.text())
      .then((txt) => parseToN3(txt, inbox))
      .then((parsedN3) => parsedN3.store)
      .then((store) =>
        store
          .getObjects(inbox, LDP("contains"), null)
          .map((obj) => obj.value)
      ).then((items) => {
        for (const e of ldns) {
          const i = items.indexOf(e.toString());
          if (i > -1) items.push(items.splice(i, 1)[0]);
        }
        // filter known
        ldns = items.filter((item) => !knownLDNs.includes(item));
        ldns.forEach(item => knownLDNs.push(item))

      })
      .then(() => ldns.forEach(ldn =>
        client.fetch(ldn, {
          headers: { Accept: "text/turtle,application/ld+json" },
        })
          .then((resp) => resp.text())
          // .then(txt => jsonld.toRDF(txt, { format: 'application/n-quads' }))
          // .then((txt) => parseToN3(txt, inbox))
          // .then((parsedN3) => parsedN3.store)
          // .then((store) =>
          // store
          // .getObjects(inbox, LDP("contains"), null)
          // .map((obj) => obj.value))
          .then(txt => JSON.parse(txt))
          // TODO check credential
          .then(req => checkCred(req))
          .then(check => {
            const req = check[0];
            const err = check[1];
            if (err) {
              console.log(err);
              return client.fetch(req["schema:agent"], {
                headers: { Accept: "text/turtle" },
              })
                .then(resp => resp.text())
                .then((txt) => parseToN3(txt, req["schema:agent"]))
                .then(parsedN3 => {
                  const { inbox: agentInbox } = getPersonalData(parsedN3.store, req["schema:agent"])
                  console.log(`### INFO  \t| Reject to\n${agentInbox}`)
                  return client.fetch(agentInbox, {
                    method: "POST",
                    body: `There is an issue with your Credential:\n ${err}`,
                    headers: { "Content-type": "text/turtle" },
                  })
                })
            }
            const reqAbout = req["schema:about"]
            const newRule = `:${new URL(reqAbout["acl:agent"]).host.split(".").join("-")}
  a acl:Authorization;
  acl:accessTo pidkg:demo;
  acl:agent <${reqAbout["acl:agent"]}>;
  acl:mode acl:Read .`;
            console.log(newRule)

            return client.fetch(`${res}.acl`, {
              headers: { Accept: "text/turtle,application/ld+json" },
            })
              .then((resp) => resp.text())
              .then(acl => { return `${acl}\n\n${newRule}` })
              .then(acl => client.fetch(`${res}.acl`, {
                method: "PUT",
                body: acl,
                headers: { "Content-type": "text/turtle" },
              }))
              .then(() => client.fetch(reqAbout["acl:agent"], {
                headers: { Accept: "text/turtle" },
              })).then(resp => resp.text())
              .then((txt) => parseToN3(txt, reqAbout["acl:agent"]))
              .then(parsedN3 => {
                const { inbox: agentInbox } = getPersonalData(parsedN3.store, reqAbout["acl:agent"])
                console.log(agentInbox)
                return client.fetch(agentInbox, {
                  method: "POST",
                  body: `You now have access to:\n ${res}`,
                  // `@prefix : <${res}.acl>.
                  //   @prefix acl: <http://www.w3.org/ns/auth/acl#>.
                  //   @prefix pidkg: <${res.split("demo")[0]}>.

                  //   ${newRule}`,
                  headers: { "Content-type": "text/turtle" },
                })
              })
          })
          .finally(() => client.fetch(ldn, { method: "DELETE" }))))

  }


  const _uri = new URL(inbox);
  _uri.protocol = "wss";
  const ws = new WebSocket(_uri.href, ["solid-0.1"]);

  ws.onopen = async () => {
    ws.send(`sub ${inbox}`);
    // fetch on open
    exec()
  };

  ws.onmessage = async (msg) => {
    if (msg.data && msg.data.slice(0, 3) === "pub") {
      // resource updated
      exec()
    }
  };

}

main();
