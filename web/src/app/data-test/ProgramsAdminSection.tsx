"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  MediaProgram,
  MediaProgramFull,
  ProgramActiveStatus,
} from "@/lib/programs";
import { ProgramDetail } from "@/components/ProgramDetail";

/**
 * /data-test admin 전용 — 프로그램 (media_programs) 운영 도구.
 *
 * - 프로그램 목록 (read-only)
 * - 새 프로그램 생성 (간단 폼)
 * - 단건 선택 시 ProgramDetail 미리보기 + host/panelist/person_link 추가
 *
 * 권한: admin auth + (쓰기) SUPABASE_SERVICE_ROLE_KEY 필요.
 * 메인 UI 무관 — admin 도구 전용.
 */

type ProgramSummary = Pick<
  MediaProgram,
  | "id"
  | "title"
  | "broadcaster"
  | "channel_name"
  | "category"
  | "active_status"
  | "influence_score"
  | "updated_at"
>;

type RelationKind = "host" | "panelist" | "person_link";

export function ProgramsAdminSection({ adminKey }: { adminKey: string }) {
  const [list, setList] = useState<ProgramSummary[] | null>(null);
  const [listLoading, setListLoading] = useState(false);
  const [listErr, setListErr] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<MediaProgramFull | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailErr, setDetailErr] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  // 새 프로그램 생성 폼
  const [nTitle, setNTitle] = useState("");
  const [nBroadcaster, setNBroadcaster] = useState("");
  const [nChannelName, setNChannelName] = useState("");
  const [nYoutubeId, setNYoutubeId] = useState("");
  const [nCategory, setNCategory] = useState("");
  const [nFreq, setNFreq] = useState("");
  const [nStatus, setNStatus] = useState<ProgramActiveStatus>("active");
  const [busy, setBusy] = useState<"create" | "addRel" | null>(null);
  const [createMsg, setCreateMsg] = useState<string | null>(null);

  // 관계 추가 폼 (선택된 프로그램에)
  const [relKind, setRelKind] = useState<RelationKind>("host");
  const [relName, setRelName] = useState("");
  const [relRole, setRelRole] = useState("");
  const [relDate, setRelDate] = useState("");
  const [relContext, setRelContext] = useState("");
  const [relSourceUrl, setRelSourceUrl] = useState("");
  const [relLinkType, setRelLinkType] = useState("guest_appearance");
  const [relMsg, setRelMsg] = useState<string | null>(null);

  const loadList = useCallback(async () => {
    setListLoading(true);
    setListErr(null);
    try {
      const res = await fetch("/api/programs?limit=100", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setList(json.programs ?? []);
    } catch (e) {
      setListErr(e instanceof Error ? e.message : String(e));
      setList([]);
    } finally {
      setListLoading(false);
    }
  }, []);

  const loadDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    setDetailErr(null);
    setDetail(null);
    try {
      const res = await fetch(`/api/programs/${id}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setDetail(json as MediaProgramFull);
    } catch (e) {
      setDetailErr(e instanceof Error ? e.message : String(e));
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    // mount + reload trigger
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadList();
  }, [loadList]);

  useEffect(() => {
    // selectedId 가 바뀌면 detail fetch (또는 clear)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (selectedId) loadDetail(selectedId);
    else setDetail(null);
  }, [selectedId, loadDetail]);

  const canWrite = !!adminKey;

  const onCreate = async () => {
    if (!canWrite || !nTitle.trim()) return;
    setBusy("create");
    setCreateMsg(null);
    try {
      const body = {
        title: nTitle.trim(),
        broadcaster: nBroadcaster.trim() || undefined,
        channel_name: nChannelName.trim() || undefined,
        youtube_channel_id: nYoutubeId.trim() || undefined,
        category: nCategory.trim() || undefined,
        upload_frequency: nFreq.trim() || undefined,
        active_status: nStatus,
      };
      const res = await fetch(`/api/admin/programs?key=${encodeURIComponent(adminKey)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setCreateMsg(`생성됨: ${json.program?.title} (id=${json.program?.id})`);
      setNTitle("");
      setNBroadcaster("");
      setNChannelName("");
      setNYoutubeId("");
      setNCategory("");
      setNFreq("");
      loadList();
    } catch (e) {
      setCreateMsg(`ERROR: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(null);
    }
  };

  const onAddRelation = async () => {
    if (!canWrite || !selectedId || !relName.trim()) return;
    setBusy("addRel");
    setRelMsg(null);
    try {
      let path: string;
      let body: Record<string, unknown>;
      if (relKind === "host") {
        path = `/api/admin/programs/${selectedId}/hosts`;
        body = {
          person_name: relName.trim(),
          role: relRole.trim() || undefined,
        };
      } else if (relKind === "panelist") {
        path = `/api/admin/programs/${selectedId}/panelists`;
        body = {
          person_name: relName.trim(),
          panel_role: relRole.trim() || undefined,
        };
      } else {
        path = `/api/admin/programs/${selectedId}/person-links`;
        body = {
          person_name: relName.trim(),
          link_type: relLinkType,
          appearance_date: relDate.trim() || undefined,
          context: relContext.trim() || undefined,
          source_url: relSourceUrl.trim() || undefined,
        };
      }
      const res = await fetch(`${path}?key=${encodeURIComponent(adminKey)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setRelMsg(`추가됨: ${relKind} ${relName}`);
      setRelName("");
      setRelRole("");
      setRelDate("");
      setRelContext("");
      setRelSourceUrl("");
      loadDetail(selectedId);
    } catch (e) {
      setRelMsg(`ERROR: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="mb-8 border-t border-border/40 pt-6">
      <h2 className="text-fg-dim text-[11px] uppercase tracking-wider mb-2">
        media_programs · 프로그램 중심 admin 도구
      </h2>
      <p className="text-fg-dim text-[11px] mb-3">
        ⚠️ 채널 단위가 아닌 프로그램 단위 (예: 김종배의 시선집중, 정치人싸).
        진행자/패널/출연자 관계는 별도 라우트로 추가. AI 임의 정치 성향 판정 ✗
        — 성향 입력은 수동.
      </p>

      {/* ── 프로그램 목록 ── */}
      <div className="mb-6">
        <div className="flex items-baseline justify-between mb-2">
          <h3 className="text-fg-dim text-[11px] uppercase tracking-wider">
            프로그램 목록 (영향력 점수 desc)
          </h3>
          <button
            type="button"
            onClick={loadList}
            disabled={listLoading}
            className="text-fg-dim hover:text-fg text-[11px] disabled:opacity-40"
          >
            {listLoading ? "갱신 중…" : "↻ 새로고침"}
          </button>
        </div>
        {listErr ? (
          <p className="text-signal-up text-[11px]">FAIL · {listErr}</p>
        ) : list && list.length > 0 ? (
          <table className="w-full text-[11px]">
            <thead>
              <tr className="text-fg-dim text-left border-b border-border/40">
                <th className="py-1">title</th>
                <th className="py-1">broadcaster</th>
                <th className="py-1">channel</th>
                <th className="py-1">category</th>
                <th className="py-1 text-right">influence</th>
                <th className="py-1">status</th>
                <th className="py-1 w-12"></th>
              </tr>
            </thead>
            <tbody>
              {list.map((p) => (
                <tr key={p.id} className="border-b border-border/30">
                  <td className="py-1 text-fg">{p.title}</td>
                  <td className="py-1 text-fg-muted">{p.broadcaster ?? "-"}</td>
                  <td className="py-1 text-fg-muted">{p.channel_name ?? "-"}</td>
                  <td className="py-1 text-fg-muted">{p.category ?? "-"}</td>
                  <td className="py-1 text-fg-muted text-right tabular-nums">
                    {p.influence_score != null
                      ? Number(p.influence_score).toFixed(2)
                      : "-"}
                  </td>
                  <td className="py-1 text-fg-dim">{p.active_status}</td>
                  <td className="py-1">
                    <button
                      type="button"
                      onClick={() => setSelectedId(p.id)}
                      className="text-fg-dim hover:text-brand text-[11px]"
                    >
                      열기
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-fg-dim text-[11px]">
            프로그램 없음 — 아래 폼으로 생성.
          </p>
        )}
      </div>

      {/* ── 새 프로그램 생성 ── */}
      <details className="mb-6">
        <summary className="text-fg text-[11px] cursor-pointer">
          + 새 프로그램 생성
        </summary>
        <div className="flex flex-col gap-2 mt-2 max-w-md">
          <input
            type="text"
            value={nTitle}
            onChange={(e) => setNTitle(e.target.value)}
            placeholder="title (예: 김종배의 시선집중) — 필수"
            className="px-2 py-1.5 bg-elev border border-border rounded text-fg text-[12px]"
          />
          <input
            type="text"
            value={nBroadcaster}
            onChange={(e) => setNBroadcaster(e.target.value)}
            placeholder="broadcaster (MBC, KBS, JTBC, YouTube …)"
            className="px-2 py-1.5 bg-elev border border-border rounded text-fg text-[12px]"
          />
          <input
            type="text"
            value={nChannelName}
            onChange={(e) => setNChannelName(e.target.value)}
            placeholder="channel_name (운영 채널명)"
            className="px-2 py-1.5 bg-elev border border-border rounded text-fg text-[12px]"
          />
          <input
            type="text"
            value={nYoutubeId}
            onChange={(e) => setNYoutubeId(e.target.value)}
            placeholder="youtube_channel_id (UC...)"
            className="px-2 py-1.5 bg-elev border border-border rounded text-fg text-[12px]"
          />
          <input
            type="text"
            value={nCategory}
            onChange={(e) => setNCategory(e.target.value)}
            placeholder="category (morning_radio / news_show / panel_debate / commentary / interview / other)"
            className="px-2 py-1.5 bg-elev border border-border rounded text-fg text-[12px]"
          />
          <input
            type="text"
            value={nFreq}
            onChange={(e) => setNFreq(e.target.value)}
            placeholder="upload_frequency (평일 매일 / 주간 …)"
            className="px-2 py-1.5 bg-elev border border-border rounded text-fg text-[12px]"
          />
          <select
            value={nStatus}
            onChange={(e) => setNStatus(e.target.value as ProgramActiveStatus)}
            className="px-2 py-1.5 bg-elev border border-border rounded text-fg text-[12px]"
          >
            <option value="active">active</option>
            <option value="on_hiatus">on_hiatus</option>
            <option value="ended">ended</option>
          </select>
          <button
            type="button"
            onClick={onCreate}
            disabled={!canWrite || !nTitle.trim() || busy === "create"}
            className="self-start px-3 py-1.5 bg-elev border border-brand rounded text-brand hover:bg-brand/10 text-[12px] disabled:opacity-40"
          >
            {busy === "create" ? "생성 중…" : "프로그램 생성"}
          </button>
          {createMsg ? (
            <p
              className={
                createMsg.startsWith("ERROR")
                  ? "text-signal-up text-[11px]"
                  : "text-accent-green text-[11px]"
              }
            >
              {createMsg}
            </p>
          ) : null}
        </div>
      </details>

      {/* ── 선택된 프로그램 ── */}
      {selectedId ? (
        <div className="border-t border-border/40 pt-4 mb-4">
          <div className="flex items-baseline justify-between mb-2">
            <h3 className="text-fg-dim text-[11px] uppercase tracking-wider">
              선택된 프로그램 (id={selectedId})
            </h3>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowPreview((v) => !v)}
                className="text-fg-dim hover:text-fg text-[11px]"
              >
                {showPreview ? "미리보기 닫기" : "ProgramDetail 미리보기"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedId(null);
                  setShowPreview(false);
                }}
                className="text-fg-dim hover:text-fg text-[11px]"
              >
                선택 해제
              </button>
            </div>
          </div>
          {detailLoading ? (
            <p className="text-fg-dim text-[11px]">불러오는 중…</p>
          ) : detailErr ? (
            <p className="text-signal-up text-[11px]">FAIL · {detailErr}</p>
          ) : detail ? (
            <>
              <div className="text-[12px] mb-2">
                <strong className="text-fg">{detail.title}</strong>{" "}
                <span className="text-fg-dim">
                  · hosts={detail.hosts.length} · panelists=
                  {detail.panelists.length} · person_links=
                  {detail.person_links.length}
                </span>
              </div>

              {/* 관계 추가 폼 */}
              <details className="mb-3">
                <summary className="text-fg text-[11px] cursor-pointer">
                  + 관계 추가 (host / panelist / person_link)
                </summary>
                <div className="flex flex-col gap-2 mt-2 max-w-md">
                  <select
                    value={relKind}
                    onChange={(e) => setRelKind(e.target.value as RelationKind)}
                    className="px-2 py-1.5 bg-elev border border-border rounded text-fg text-[12px]"
                  >
                    <option value="host">host (진행자)</option>
                    <option value="panelist">panelist (고정 패널)</option>
                    <option value="person_link">
                      person_link (게스트/언급/클립)
                    </option>
                  </select>
                  <input
                    type="text"
                    value={relName}
                    onChange={(e) => setRelName(e.target.value)}
                    placeholder="person_name (예: 김종배)"
                    className="px-2 py-1.5 bg-elev border border-border rounded text-fg text-[12px]"
                  />
                  {relKind !== "person_link" ? (
                    <input
                      type="text"
                      value={relRole}
                      onChange={(e) => setRelRole(e.target.value)}
                      placeholder={
                        relKind === "host"
                          ? "role (진행자/공동진행자/MC)"
                          : "panel_role (고정 패널/평론가/…)"
                      }
                      className="px-2 py-1.5 bg-elev border border-border rounded text-fg text-[12px]"
                    />
                  ) : (
                    <>
                      <select
                        value={relLinkType}
                        onChange={(e) => setRelLinkType(e.target.value)}
                        className="px-2 py-1.5 bg-elev border border-border rounded text-fg text-[12px]"
                      >
                        <option value="guest_appearance">guest_appearance</option>
                        <option value="mention">mention</option>
                        <option value="clip_subject">clip_subject</option>
                        <option value="interview">interview</option>
                      </select>
                      <input
                        type="date"
                        value={relDate}
                        onChange={(e) => setRelDate(e.target.value)}
                        className="px-2 py-1.5 bg-elev border border-border rounded text-fg text-[12px]"
                      />
                      <input
                        type="text"
                        value={relContext}
                        onChange={(e) => setRelContext(e.target.value)}
                        placeholder="context (코너명/발언 요지 등)"
                        className="px-2 py-1.5 bg-elev border border-border rounded text-fg text-[12px]"
                      />
                      <input
                        type="text"
                        value={relSourceUrl}
                        onChange={(e) => setRelSourceUrl(e.target.value)}
                        placeholder="source_url (영상/기사)"
                        className="px-2 py-1.5 bg-elev border border-border rounded text-fg text-[12px]"
                      />
                    </>
                  )}
                  <button
                    type="button"
                    onClick={onAddRelation}
                    disabled={
                      !canWrite || !relName.trim() || busy === "addRel"
                    }
                    className="self-start px-3 py-1.5 bg-elev border border-brand rounded text-brand hover:bg-brand/10 text-[12px] disabled:opacity-40"
                  >
                    {busy === "addRel" ? "추가 중…" : "추가"}
                  </button>
                  {relMsg ? (
                    <p
                      className={
                        relMsg.startsWith("ERROR")
                          ? "text-signal-up text-[11px]"
                          : "text-accent-green text-[11px]"
                      }
                    >
                      {relMsg}
                    </p>
                  ) : null}
                </div>
              </details>

              {/* hosts / panelists / links 요약 */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[11px]">
                <RelationList
                  title="진행자"
                  items={detail.hosts.map((h) => ({
                    pri: h.person_name,
                    sec: h.role + (h.active ? "" : " · 종료"),
                  }))}
                />
                <RelationList
                  title="고정 패널"
                  items={detail.panelists.map((p) => ({
                    pri: p.person_name,
                    sec:
                      [p.panel_role, p.cadence].filter(Boolean).join(" · ") ||
                      "고정 패널",
                  }))}
                />
                <RelationList
                  title="person_links"
                  items={detail.person_links.slice(0, 10).map((l) => ({
                    pri: l.person_name,
                    sec: `${l.link_type}${l.appearance_date ? " · " + l.appearance_date : ""}`,
                  }))}
                />
              </div>
            </>
          ) : null}
        </div>
      ) : null}

      {/* ── ProgramDetail 미리보기 (full-screen overlay) ── */}
      {showPreview && detail ? (
        <ProgramDetail
          program={detail}
          isInterested={false}
          onToggleInterest={() => {
            /* admin preview — no-op */
          }}
          onClose={() => setShowPreview(false)}
        />
      ) : null}
    </section>
  );
}

function RelationList({
  title,
  items,
}: {
  title: string;
  items: { pri: string; sec: string }[];
}) {
  return (
    <div className="border border-border/30 rounded p-2">
      <h4 className="text-fg-dim text-[10px] uppercase tracking-wider mb-1">
        {title} ({items.length})
      </h4>
      {items.length > 0 ? (
        <ul className="space-y-1">
          {items.map((it, i) => (
            <li key={i}>
              <div className="text-fg">{it.pri}</div>
              <div className="text-fg-dim text-[10px]">{it.sec}</div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-fg-dim text-[10px]">없음</p>
      )}
    </div>
  );
}
