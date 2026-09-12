import { IDocsContentSource } from '@/contracts/DocsContentSource';
import { navigation } from '@/infrastructure/content/navigation';
import { docPages, docPageList } from '@/infrastructure/content/docs';
import { concepts } from '@/infrastructure/content/concepts';
import { stateMachine } from '@/infrastructure/content/stateMachine';
import { eventFlow } from '@/infrastructure/content/eventFlow';
import { runtimeEvents } from '@/infrastructure/content/runtimeEvents';

/**
 * In-memory implementation of the documentation content boundary.
 * Serves static local content today; a future implementation can load
 * generated repository docs behind the same interface with no page changes.
 *
 * @implements {IDocsContentSource}
 */
export class InMemoryDocsContentSource extends IDocsContentSource {
  getNavigation() {
    return navigation;
  }

  listPages() {
    return docPageList;
  }

  getPage(slug) {
    return docPages[slug] || null;
  }

  getConcepts() {
    return concepts;
  }

  getStateMachine() {
    return stateMachine;
  }

  getEventFlow() {
    return eventFlow;
  }

  getRuntimeEvents() {
    return runtimeEvents;
  }
}
