type HackathonCardProps = {
  title: string
  status: string
  tags: string[]
  thumbnailUrl: string
  deadline: string
  onClick?: () => void
  isInterested?: boolean
  onToggleInterest?: () => void
}

function formatDeadline(isoDate: string): string {
  const date = new Date(isoDate)
  if (Number.isNaN(date.getTime())) return isoDate
  return date.toLocaleString()
}

export default function HackathonCard({
  title,
  status,
  tags,
  thumbnailUrl,
  deadline,
  onClick,
  isInterested = false,
  onToggleInterest,
}: HackathonCardProps) {

  return (
    <div
      onClick={onClick}
      style={{
        border: '1px solid gray',
        padding: 20,
        margin: 10,
        cursor: onClick ? 'pointer' : 'default',
        position: 'relative',
      }}
    >
      {onToggleInterest ? (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            onToggleInterest()
          }}
          aria-label={isInterested ? '관심 해제' : '관심 등록'}
          title={isInterested ? '관심 해제' : '관심 등록'}
          style={{
            position: 'absolute',
            top: 10,
            right: 10,
            height: 32,
            padding: '0 12px',
            borderRadius: 9999,
            border: `1px solid ${isInterested ? '#fda4af' : '#d1d5db'}`,
            backgroundColor: isInterested ? '#fff1f2' : '#ffffff',
            color: isInterested ? '#be123c' : '#374151',
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: 700,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <span aria-hidden="true" style={{ fontSize: 13 }}>
            {isInterested ? '♥' : '♡'}
          </span>
          <span>{isInterested ? '관심 있는 해커톤' : '관심 등록'}</span>
        </button>
      ) : null}
      <img
        src={thumbnailUrl}
        alt={title}
        style={{ width: '100%', maxWidth: 420, height: 200, objectFit: 'cover' }}
      />
      <h3>{title}</h3>
      <p>{status}</p>
      <p>{tags.join(', ')}</p>
      <p>Submission Deadline: {formatDeadline(deadline)}</p>
    </div>
  )
}
