import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";

export function JoinQrButton() {
  const [isOpen, setIsOpen] = useState(false);
  const joinUrl = "https://team4-mln122.honggam.io.vn/";

  useEffect(() => {
    if (!isOpen) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [isOpen]);

  return (
    <>
      <button
        type="button"
        className="join-qr-open-button"
        aria-label="Mở mã QR mời đội tham gia"
        title="Mở mã QR mời đội tham gia"
        onClick={() => setIsOpen(true)}
      >
        <span aria-hidden="true">▦</span>
        <span className="join-qr-label">Mở mã QR</span>
      </button>
      {isOpen && (
        <div
          className="join-qr-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setIsOpen(false);
          }}
        >
          <section
            className="join-qr-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="join-qr-title"
          >
            <button
              type="button"
              className="join-qr-close"
              aria-label="Đóng mã QR"
              onClick={() => setIsOpen(false)}
            >
              ×
            </button>
            <span className="join-qr-eyebrow">MỜI CÁC ĐỘI THAM GIA</span>
            <h2 id="join-qr-title">Quét mã để vào phòng</h2>
            <div className="join-qr-code">
              <QRCodeSVG
                value={joinUrl}
                size={256}
                level="M"
                marginSize={4}
                title="Mã QR vào phòng chơi Capitalism Mystery"
              />
            </div>
            <p>Dùng camera điện thoại để quét mã và mở trang chọn đội.</p>
            <a className="join-qr-url" href={joinUrl}>{joinUrl}</a>
          </section>
        </div>
      )}
    </>
  );
}
