"use client";

import "./style.css";

import { Dispatch, useCallback, useEffect, useId, useState } from "react";

import { importKey, encode, decode } from "@/secret";

function useKey(text: string): CryptoKey | undefined {
  const [key, setKey] = useState<CryptoKey | undefined>();
  useEffect(() => {
    setKey(void 0);
    if (text === "") {
      return;
    }

    const abort = new AbortController();
    (async () => {
      const result = await importKey(text);
      setKey(result);
    })();
    return () => abort.abort();
  }, [text]);

  return key;
}

function useUrl(text: string): URL | undefined {
  const [url, setUrl] = useState<URL | undefined>();
  useEffect(() => {
    try {
      setUrl(new URL(text));
    } catch (e) {
      setUrl(void 0);
    }
  }, [text]);

  return url;
}

function useRange(beginText: string, numText: string): [bigint, bigint] | undefined {
  const [range, setRange] = useState<[bigint, bigint] | undefined>();
  useEffect(() => {
    setRange(void 0);
    const begin = BigInt(beginText);
    const num = BigInt(numText);
    setRange([begin, begin + num]);
  }, [beginText, numText]);

  return range;
}

function useDecode(key: CryptoKey | undefined, target: string): bigint | undefined {
  const [state, setState] = useState<bigint | undefined>();
  useEffect(() => {
    setState(void 0);

    const abort = new AbortController();
    (async () => {
      if (typeof key === "undefined") {
        return;
      }

      try {
        const u = new URL(target);
        const lk = u.searchParams.get("lk");
        if (lk === null) {
          return;
        }
        const result = await decode(key, lk);
        setState(result);
        return;
      } catch (e) {
        // pass
      }

      try {
        const result = await decode(key, target);
        setState(result);
      } catch (e) {
        // pass
      }
    })();
    return () => abort.abort();
  }, [key, target]);


  return state;
}

function useEncode(key: CryptoKey | undefined, url: URL | undefined, range: [bigint, bigint] | undefined): [bigint, URL][] | undefined {
  const [urls, setUrls] = useState<[bigint, URL][] | undefined>();
  useEffect(() => {
    setUrls([]);

    const abort = new AbortController();
    (async () => {
      if (typeof key === "undefined" || typeof url === "undefined" || typeof range === "undefined") {
        return;
      }

      const [begin ,end] = range;
      for (let n = begin; n < end; n++) {
        const lk = await encode(key, n);
        if (abort.signal.aborted) {
          return;
        }

        const query = new URLSearchParams({ lk });
        setUrls((before) => [...(before ?? []), [n, new URL(`?${query}`, url)]]);
      }
    })();
    return () => abort.abort();
  }, [key, url, range]);

  return urls;
}

function usePersistedState(name: string): [string, Dispatch<string>] {
  const [state, setState] = useState("");
  useEffect(() => {
    const value = localStorage.getItem(name);
    setState(value ?? "");
  }, [name]);
  const dispatch = useCallback<Dispatch<string>>((input) => {
    localStorage.setItem(name, input);
    setState(input);
  }, [name]);

  return [state, dispatch];
}

export default function Home() {
  const [keyText, setKeyText] = usePersistedState("key");
  const [orUrl, setOrUrl] = useState<string>("");
  const [urlText, setUrlText] = usePersistedState("url");
  const [beginText, setBeginText] = useState<string>("1");
  const [numText, setNumText] = useState<string>("1");

  const key = useKey(keyText);
  const decoded = useDecode(key, orUrl);
  const url = useUrl(urlText);
  const range = useRange(beginText, numText);
  const urls = useEncode(key, url, range);

  const idKey = useId();

  const idOrUrl = useId();

  const idUrl = useId();
  const idBegin = useId();
  const idNum = useId();

  return (
    <main>
      <h1>SUPER SECRET SYSTEM.</h1>
      <form>
        <label htmlFor={idKey}>Key</label>
        <input id={idKey} type="text" value={keyText} onChange={evt => setKeyText(evt.target.value)} />
      </form>
      <h2>decode</h2>
      <form>
        <label htmlFor={idOrUrl}>Text or URL</label>
        <input id={idOrUrl} type="text" value={orUrl} onChange={evt => setOrUrl(evt.target.value)} />
      </form>
      <output>{decoded?.toString()}</output>
      <h2>encode</h2>
      <form>
        <label htmlFor={idUrl}>URL</label>
        <input id={idUrl} type="url" value={urlText} onChange={evt => setUrlText(evt.target.value)} />
        <label htmlFor={idBegin}>Begin</label>
        <input id={idBegin} type="number" value={beginText} onChange={evt => setBeginText(evt.target.value)} />
        <label htmlFor={idNum}>Num</label>
        <input id={idNum} type="number" value={numText} onChange={evt => setNumText(evt.target.value)} />
      </form>
      <ul>
        {urls && urls.map(([n, url]) => <li key={n}>
          {n.toString()} <a href={url.href} target="_blank">{url.href}</a>
        </li>)}
      </ul>
    </main>
  );
}
