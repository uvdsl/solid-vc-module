import { Store } from "n3";
import { AS, PUSH, RDF, VCARD, LDP } from "./namespaces";

export const getPersonalData =   (store: Store, webId: string)=> {
  let query = store.getObjects(webId, VCARD("hasPhoto"), null);
  const img = query.length > 0 ? query[0].value : "";
  query = store.getObjects(webId, VCARD("fn"), null);
  const name = query.length > 0 ? query[0].value : "";
  query = store.getObjects(webId, LDP("inbox"), null);
  const inbox = query.length > 0 ? query[0].value : "";
  return { name, img, inbox };
};

