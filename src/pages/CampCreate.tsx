import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { createTeam } from "../api/teamApi"

export default function CampCreate() {

  const navigate = useNavigate()

  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [isOpen, setIsOpen] = useState(true)
  const [lookingFor, setLookingFor] = useState("")
  const [contactUrl, setContactUrl] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!name || !description) {
      alert("팀명과 소개는 필수입니다.")
      return
    }

    await createTeam({
      name,
      description,
      isOpen,
      lookingFor: lookingFor.split(",").map((v) => v.trim()),
      contactUrl
    })

    navigate("/camp")
  }

  return (
    <div style={{ padding: "20px" }}>
      <h1>팀 모집글 생성</h1>

      <form onSubmit={handleSubmit}>

        <div>
          <label>팀명 *</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>

        <div>
          <label>소개 *</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
          />
        </div>

        <div>
          <label>모집중 여부</label>
          <input
            type="checkbox"
            checked={isOpen}
            onChange={(e) => setIsOpen(e.target.checked)}
          />
        </div>

        <div>
          <label>모집 포지션 (쉼표로 구분)</label>
          <input
            value={lookingFor}
            onChange={(e) => setLookingFor(e.target.value)}
            placeholder="Frontend, Backend"
          />
        </div>

        <div>
          <label>연락 링크</label>
          <input
            value={contactUrl}
            onChange={(e) => setContactUrl(e.target.value)}
            placeholder="https://open.kakao.com/..."
          />
        </div>

        <button type="submit">생성</button>

      </form>
    </div>
  )
}