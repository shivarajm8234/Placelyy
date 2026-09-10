import { Link } from 'react-router-dom'
import {
  CATEGORY_LABELS,
  type PlacementDocument,
} from '../types/document'

interface Props {
  document: PlacementDocument
  index: number
}

export function DocumentRow({ document: doc, index }: Props) {
  return (
    <li
      className="doc-row"
      style={{ animationDelay: `${0.04 * index}s` }}
    >
      <Link to={`/view/${doc.id}`} className="doc-row__link">
        <div className="doc-row__meta">
          <span className="doc-row__type" data-type={doc.type}>
            {doc.type.toUpperCase()}
          </span>
          <span className="doc-row__category">
            {CATEGORY_LABELS[doc.category]}
          </span>
        </div>
        <h3 className="doc-row__title">{doc.title}</h3>
        <p className="doc-row__desc">{doc.description}</p>
        <div className="doc-row__foot">
          <span className="doc-row__date">
            Updated {doc.updatedAt || '—'}
          </span>
          <span className="doc-row__cta">Open →</span>
        </div>
      </Link>
    </li>
  )
}
