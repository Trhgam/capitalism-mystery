import { useState } from "react";
import { Brand } from "../components/Brand.jsx";

export function AdminLogin({ onLogin, error }) {
  const [code, setCode] = useState("");
  return <main className="center-page"><form className="join-card" onSubmit={(event) => { event.preventDefault(); onLogin(code); }}><Brand/><div className="step">Admin console</div><h1>Xác thực quản trị</h1><label>Mã Admin<input type="password" value={code} onChange={(event) => setCode(event.target.value)} autoFocus /></label>{error && <div className="form-error">{error}</div>}<button className="primary wide">Mở bảng điều khiển</button></form></main>;
}
