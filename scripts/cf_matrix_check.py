import pandas as pd
import numpy as np
from scipy.sparse import coo_matrix
from sklearn.preprocessing import normalize
from sklearn.metrics.pairwise import cosine_similarity

# 1) 위 SQL 결과를 CSV로 저장했다고 가정 (columns: user_id,item_id,score)
df = pd.read_csv("tmp/cf_scored.csv")

# 2) 인덱스 매핑
u_codes, u_uniques = pd.factorize(df["user_id"])
i_codes, i_uniques = pd.factorize(df["item_id"])

# 3) COO -> CSR
R = coo_matrix(
    (df["score"].values, (u_codes, i_codes)),
    shape=(len(u_uniques), len(i_uniques))
).tocsr()

print("shape:", R.shape)
print("nnz:", R.nnz)
print("sparsity:", 1 - R.nnz / (R.shape[0] * R.shape[1]))

# 4) 행렬 샘플 확인 (상위 10x10 dense)
sample = R[:10, :10].toarray()
print(pd.DataFrame(sample,
                   index=u_uniques[:10],
                   columns=i_uniques[:10]))

# 5) 사용자 벡터 L2 정규화 + 유사도
R_norm = normalize(R, norm="l2", axis=1)
S = cosine_similarity(R_norm)  # user-user similarity matrix
print("similarity matrix shape:", S.shape)

def recommend_for_user(user_id, R, R_norm, S, u_uniques, i_uniques, topk_user=10, topk_item=5, item_prefix="hack"):
    u2idx = {u:i for i,u in enumerate(u_uniques)}
    uid = u2idx[user_id]

    sims = S[uid].copy()
    sims[uid] = 0.0
    nbr_idx = np.argsort(sims)[::-1][:topk_user]

    user_seen = set(R[uid].indices.tolist())
    scores = {}

    for v in nbr_idx:
        sim = sims[v]
        if sim <= 0:
            continue
        for j, val in zip(R[v].indices, R[v].data):
            item_id = str(i_uniques[j])
            if item_prefix and not item_id.startswith(item_prefix):
                continue
            if j in user_seen:
                continue
            scores[j] = scores.get(j, 0.0) + sim * val

    rec = sorted(scores.items(), key=lambda x: x[1], reverse=True)[:topk_item]
    return [(i_uniques[j], s) for j, s in rec]

print(recommend_for_user(u_uniques[0], R, R_norm, S, u_uniques, i_uniques, item_prefix="hack"))