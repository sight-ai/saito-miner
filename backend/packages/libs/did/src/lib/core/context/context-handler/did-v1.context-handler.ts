import DidV1Context from './assets/did-v1.json';
import {GenericContextHandler} from "./context-handler";

export const didV1ContextHandler = new GenericContextHandler(DidV1Context['@context'], 'https://www.w3.org/ns/did/v1');