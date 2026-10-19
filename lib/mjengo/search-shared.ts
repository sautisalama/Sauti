/** What the browser and the server both need to know about workspace search. */
export type SearchType = 'file' | 'meeting' | 'todo' | 'event' | 'grant' | 'opportunity' | 'project' | 'fellowship';

export const SEARCH_TYPE_LABEL: Record<SearchType, string> = {
  file: 'Document', meeting: 'Call', todo: 'To-do', event: 'Event', grant: 'Grant', opportunity: 'Opportunity', project: 'Project', fellowship: 'Fellowship',
};

export interface SearchPerson { id: string; name: string }

export interface SearchHit {
  type: SearchType;
  id: string;
  title: string;
  link: string | null;
  /** The passage that matched, around the matched fragment when it was found by its words. */
  snippet: string;
  /** The text to highlight in the snippet (the fragment typed), when there is one. */
  hit: string | null;
  tags: string[];
  people: SearchPerson[];
  score: number;
  /** Found by what it is about, by its exact words, or both. */
  via: 'meaning' | 'text' | 'both';
}

export interface SearchFilters {
  types?: SearchType[];
  /** Only things with at least one of these tags. */
  tags?: string[];
  /** Only things this team member owns, leads, is assigned, was in or has been given. */
  member?: string | null;
}

export interface SearchResult { hits: SearchHit[]; /** Meaning search was not available, so only exact words were used. */ lexicalOnly: boolean; /** Things still being read into the index. */ pending: number }
