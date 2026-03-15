type HackathonCardProps = {
  title: string
  status: string
  tags: string[]
  thumbnailUrl: string
  deadline: string
  onClick?: () => void
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
}: HackathonCardProps) {

  return (
    <div
      onClick={onClick}
      style={{
        border: '1px solid gray',
        padding: 20,
        margin: 10,
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
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
