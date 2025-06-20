import SightDidV1Context from './assets/sight-did-v1.json';
import {GenericContextHandler} from "./context-handler";

export const sightDidV1ContextHandler = new GenericContextHandler(SightDidV1Context['@context'], 'https://schemas.sight.ai/did-service-extension/v1');
