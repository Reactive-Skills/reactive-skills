// Content model type definitions (JSDoc only — no runtime footprint).
// These describe the shapes exchanged across the IDocsContentSource boundary
// so page components can stay decoupled from any concrete source.

/**
 * @typedef {Object} CodeExample
 * @property {string} language
 * @property {string} command
 * @property {string} [explanation]
 * @property {string} [expectedOutput]
 */

/**
 * @typedef {Object} DocBlock
 * @property {'text'|'list'|'code'|'callout'|'table'|'steps'} type
 * @property {string} [text]
 * @property {string[]} [items]
 * @property {CodeExample} [example]
 * @property {'info'|'signal'|'warn'|'danger'} [variant]
 * @property {string} [title]
 * @property {string} [caption]
 * @property {string[]} [columns]
 * @property {string[][]} [rows]
 * @property {{title:string, text:string}[]} [steps]
 */

/**
 * @typedef {Object} DocSection
 * @property {string} id
 * @property {string} heading
 * @property {DocBlock[]} blocks
 */

/**
 * @typedef {Object} RelatedPage
 * @property {string} title
 * @property {string} href
 */

/**
 * @typedef {Object} DocPage
 * @property {string} slug
 * @property {string} title
 * @property {string} summary
 * @property {string} category
 * @property {string} href
 * @property {DocSection[]} sections
 * @property {RelatedPage[]} relatedPages
 */

/**
 * @typedef {Object} Concept
 * @property {string} name
 * @property {string} summary
 * @property {string[]} relatedConcepts
 */

/**
 * @typedef {Object} RuntimeEvent
 * @property {string} eventType
 * @property {string} state
 * @property {string} source
 * @property {string} traceId
 * @property {string} timestamp
 */

/**
 * @typedef {Object} StateNode
 * @property {string} name
 * @property {string} description
 * @property {string|null} guard
 * @property {string|null} transitionsTo
 * @property {string} emits
 */

/**
 * @typedef {Object} NavLink
 * @property {string} title
 * @property {string} href
 */

/**
 * @typedef {Object} NavGroup
 * @property {string} title
 * @property {NavLink[]} links
 */

/**
 * @typedef {Object} DocsNavigation
 * @property {NavGroup[]} groups
 */

/**
 * @typedef {Object} SkillTransition
 * @property {string} signal
 * @property {string} target
 * @property {string} [guard]
 */

/**
 * @typedef {Object} SkillState
 * @property {string} name
 * @property {string} description
 * @property {string[]} [tools]
 * @property {SkillTransition[]} [transitions]
 * @property {string[]} [substates]
 */

/**
 * @typedef {Object} RegistrySkillSummary
 * @property {string} slug
 * @property {string} name
 * @property {string} version
 * @property {string} category
 * @property {string} description
 * @property {string[]} tags
 * @property {number} stateCount
 * @property {boolean} strictExecution
 * @property {string[]} tools
 * @property {string} installCmd
 * @property {string} [skillsShInstallCmd]
 * @property {boolean} [featured]
 * @property {string} [priorityBadge]
 * @property {string} [featuredReason]
 * @property {string} [author]
 */

/**
 * @typedef {Object} RegistrySkillDetail
 * @property {string} slug
 * @property {string} name
 * @property {string} version
 * @property {string} [schemaVersion]
 * @property {string} category
 * @property {string} description
 * @property {string[]} tags
 * @property {number} stateCount
 * @property {boolean} strictExecution
 * @property {string[]} tools
 * @property {string} installCmd
 * @property {string} [skillsShInstallCmd]
 * @property {boolean} [featured]
 * @property {string} [priorityBadge]
 * @property {string} [featuredReason]
 * @property {string} initialState
 * @property {string[]} contextKeys
 * @property {Record<string, any>} [defaultContext]
 * @property {SkillState[]} states
 * @property {string} [mermaidChart]
 * @property {string[]} [deliverables]
 * @property {string} [readme]
 * @property {string} [author]
 */

export const STATE_NAMES = ['EXPLORE', 'PLAN', 'EXECUTE', 'VERIFY', 'DONE'];

/**
 * @typedef {Object} BlogAuthor
 * @property {string} name
 * @property {string} role
 * @property {string} [handle]
 * @property {string} [avatar]
 */

/**
 * @typedef {Object} BlogSeries
 * @property {string} id
 * @property {string} title
 * @property {number} part
 * @property {number} total
 * @property {string} [nextSlug]
 * @property {string} [prevSlug]
 */

/**
 * @typedef {Object} BlogPost
 * @property {string} slug
 * @property {string} title
 * @property {string} subtitle
 * @property {string} summary
 * @property {string} publishedAt
 * @property {string} readTime
 * @property {string} category
 * @property {string[]} tags
 * @property {BlogAuthor} author
 * @property {BlogSeries} [series]
 * @property {boolean} [featured]
 * @property {DocSection[]} sections
 */

export {};

