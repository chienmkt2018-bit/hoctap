import Spline from '@splinetool/react-spline';

type Props = {
  awardedXp: number;
  totalXp: number;
};

const sceneUrl = 'https://prod.spline.design/KyLG9DitDLYlWse1/scene.splinecode';

export default function RewardBadge({ awardedXp, totalXp }: Props) {
  return (
    <section className="xp-reward-badge" aria-label="Huy hiệu XP đã được máy chủ xác nhận">
      <div className="xp-reward-badge__scene">
        <Spline scene={sceneUrl} />
      </div>
      <div className="xp-reward-badge__details" aria-live="polite">
        <p className="section-kicker">QUIZ VERIFIED · REWARD BADGE</p>
        <h2>{awardedXp > 0 ? `+${awardedXp} XP` : 'Không có XP cộng thêm'}</h2>
        <p>
          {awardedXp > 0
            ? 'XP cộng thêm đã được backend xác nhận sau khi hoàn thành quiz.'
            : 'Kết quả đã được backend xác nhận; lần này không phát sinh XP mới.'}
        </p>
        <div className="xp-reward-badge__total">
          <span>Tổng XP tài khoản</span>
          <strong>{totalXp.toLocaleString('vi-VN')} XP</strong>
        </div>
        <small>Chạm huy hiệu chỉ kích hoạt hiệu ứng 3D, không cộng XP.</small>
      </div>
    </section>
  );
}
