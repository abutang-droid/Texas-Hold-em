import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  actStudHand,
  formatApiError,
  getProfile,
  getStudConfig,
  getStudHand,
  isStudUnavailableError,
  startStudHand,
  type StudHandView,
} from '../src/api/client';
import { loadSession } from '../src/storage/session';
import { PlayingCard } from '../src/components/ui/PlayingCard';
import { GameModal } from '../src/components/ui/GameModal';
import { colors, palette, spacing, typography } from '../src/theme';

const STUD_UI_REV = '2026-09-14-cards';

const DEFAULT_ANTES = [1, 2, 5, 10, 20];

const CHIP_FACE: Record<number, string> = {
  1: '#F4F6F7',
  2: '#F7E7A8',
  5: '#3B82F6',
  10: '#EF4444',
  20: '#166534',
};

function signed(n: number): string {
  if (n > 0) return `+${n.toLocaleString()}`;
  return n.toLocaleString();
}

function chipColor(n: number): string {
  return CHIP_FACE[n] ?? colors.brand.primary;
}

export default function CaribbeanStudScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const phone = Math.min(width, 430);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [antes, setAntes] = useState<number[]>(DEFAULT_ANTES);
  const [paytable, setPaytable] = useState<Array<{ category: string; odds: number }>>([]);
  const [ante, setAnte] = useState(2);
  const [hand, setHand] = useState<StudHandView | null>(null);
  const [balance, setBalance] = useState(0);
  const [sessionNet, setSessionNet] = useState(0);
  const [hands, setHands] = useState(0);
  const [helpOpen, setHelpOpen] = useState(false);
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const minAnte = antes[0] ?? 1;
  const maxAnte = antes[antes.length - 1] ?? 20;
  const settled = hand?.phase === 'SETTLED';
  const deciding = hand?.phase === 'DECISION';
  const canRaise = Boolean(deciding && balance >= (hand?.raiseToCall ?? ante * 2));
  const idle = !hand || settled;

  const studError = (e: unknown) =>
    isStudUnavailableError(e) ? t('errors.stud_unavailable') : formatApiError((e as Error).message, t);

  const boot = useCallback(async () => {
    setError(null);
    try {
      const session = await loadSession();
      if (session?.user) setBalance(session.user.chipsBalance);
      try {
        const profile = await getProfile();
        setBalance(profile.chipsBalance);
      } catch {
        /* keep session balance so Deal is not stuck disabled */
      }

      try {
        const cfg = await getStudConfig();
        setAntes(cfg.anteOptions.length ? cfg.anteOptions : DEFAULT_ANTES);
        setPaytable(cfg.paytable);
      } catch (e) {
        setError(studError(e));
      }

      try {
        const open = await getStudHand();
        setBalance(open.chipsBalance);
        setHand(open.hand);
        if (open.hand?.ante) setAnte(open.hand.ante);
      } catch (e) {
        setError(studError(e));
      }
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (__DEV__) console.log(`[mobile] stud ui ${STUD_UI_REV}`);
    void boot();
  }, [boot]);

  const run = async (fn: () => Promise<StudHandView>) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const next = await fn();
      if (next.phase === 'SETTLED' && next.result && hand?.phase !== 'SETTLED') {
        setSessionNet((n) => n + next.result!.net);
        setHands((n) => n + 1);
      }
      setHand(next);
      setBalance(next.chipsBalance);
    } catch (e) {
      setError(studError(e));
    } finally {
      setBusy(false);
    }
  };

  const onDeal = () => {
    if (balance < ante) {
      setError(t('stud.need_chips'));
      return;
    }
    void run(() => startStudHand(ante));
  };

  const onAnteSpot = () => {
    if (busy) return;
    if (idle) onDeal();
  };

  const onRaiseSpot = () => {
    if (!deciding || busy || !canRaise) return;
    void run(() => actStudHand('raise'));
  };

  const outcomeText = () => {
    const r = hand?.result;
    if (!r) return '';
    if (r.outcome === 'fold') return t('stud.outcome_fold', { ante: hand?.ante });
    if (r.outcome === 'dealer_no_qualify') return t('stud.outcome_no_qualify');
    if (r.outcome === 'player_win') return t('stud.outcome_win', { odds: r.anteOdds });
    if (r.outcome === 'dealer_win') return t('stud.outcome_lose');
    return t('stud.outcome_push');
  };

  const helpBody = useMemo(
    () =>
      `${t('stud.rule_1')}\n${t('stud.rule_2')}\n${t('stud.rule_3')}\n${t('stud.rule_4')}\n${t('stud.rule_5')}\n\n${t('stud.paytable')}\n${paytable
        .map((row) => `${t(`stud.cat_${row.category}`)}  1:${row.odds}`)
        .join('\n')}`,
    [paytable, t],
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={styles.loading}>{t('common.loading')}</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={[styles.phone, { width: phone }]}>
        <View style={styles.iconBar}>
          <IconBtn label="×" onPress={() => router.back()} />
          <View style={styles.iconBarRight}>
            <IconBtn label="☰" onPress={() => router.back()} />
            <IconBtn label="?" onPress={() => setHelpOpen(true)} />
            <IconBtn label="i" onPress={() => setHelpOpen(true)} />
            <IconBtn label={muted ? '—' : '♪'} onPress={() => setMuted((m) => !m)} />
            <IconBtn label="⌂" onPress={() => router.replace('/')} />
          </View>
        </View>

        <View style={styles.stats}>
          <Stat label={t('stud.stat_balance')} value={balance.toLocaleString()} />
          <Stat label={t('stud.stat_hands')} value={String(hands)} align="right" />
          <Stat label={t('stud.stat_ante')} value={String(hand?.ante ?? ante)} />
          <Stat label={t('stud.stat_net')} value={signed(sessionNet)} align="right" />
        </View>

        <View style={styles.limits}>
          <Text style={styles.limitLine}>
            {t('stud.max_bet')}  {maxAnte.toLocaleString()}
          </Text>
          <Text style={styles.limitLine}>
            {t('stud.min_bet')}  {minAnte.toLocaleString()}
          </Text>
        </View>

        <View style={styles.banner}>
          <Text style={styles.bannerText}>{t('stud.qualify_banner')}</Text>
        </View>

        {hand ? (
          <View style={styles.cardLane}>
            <Text style={styles.laneLabel}>{t('stud.dealer')}</Text>
            <View style={styles.cardRow}>
              {(hand.dealerCards ?? ['**', '**']).map((code, i) => (
                <PlayingCard key={`d-${i}`} code={code || '**'} size="md" faceDown={!code || code === '**'} />
              ))}
            </View>
            <View style={styles.cardRow}>
              {(hand.community ?? []).filter(Boolean).map((code, i) => (
                <PlayingCard key={`c-${i}`} code={code} size="sm" />
              ))}
            </View>
          </View>
        ) : (
          <View style={styles.cardLaneSpacer} />
        )}

        <Text style={styles.heroTitle}>{t('stud.hero_title')}</Text>
        <Text style={styles.heroSub}>{t('stud.hero_sub')}</Text>

        <View style={styles.spots}>
          <BetSpot
            label={t('stud.spot_qualify')}
            onPress={() => setHelpOpen(true)}
            size={64}
          />
          <View style={styles.spotRow}>
            <View style={styles.spotLine} />
            <BetSpot
              label={t('stud.ante')}
              onPress={onAnteSpot}
              active={idle && !busy && balance >= ante}
              stacked={idle ? ante : hand?.ante}
              disabled={busy || (!idle && !settled)}
            />
            <View style={styles.spotLine} />
          </View>
          <BetSpot
            label={deciding ? t('stud.raise', { amount: hand?.raiseToCall ?? ante * 2 }) : t('stud.spot_raise')}
            onPress={onRaiseSpot}
            active={canRaise}
            stacked={deciding ? hand.raiseToCall : undefined}
            disabled={!canRaise}
          />
        </View>

        {hand ? (
          <View style={styles.cardLane}>
            <Text style={styles.laneLabel}>{t('stud.player')}</Text>
            <View style={styles.cardRow}>
              {(hand.playerCards ?? ['**', '**']).map((code, i) => (
                <PlayingCard key={`p-${i}`} code={code || '**'} size="xl" faceDown={!code || code === '**'} />
              ))}
            </View>
            {settled ? <Text style={styles.outcome}>{outcomeText()}</Text> : null}
          </View>
        ) : null}

        {error ? (
          <Pressable onPress={() => void boot()} style={styles.errorTap}>
            <Text style={styles.error}>{error}</Text>
            <Text style={styles.retry}>{t('stud.retry')}</Text>
          </Pressable>
        ) : null}

        {deciding ? (
          <Pressable
            onPress={() => void run(() => actStudHand('fold'))}
            disabled={busy}
            style={styles.foldBtn}
          >
            <Text style={styles.foldText}>{t('stud.fold')}</Text>
          </Pressable>
        ) : null}

        <View style={styles.rail}>
          <View style={styles.chipRow}>
            {antes.map((n) => {
              const on = ante === n;
              const face = chipColor(n);
              const dark = n >= 5;
              return (
                <Pressable
                  key={n}
                  onPress={() => idle && setAnte(n)}
                  disabled={!idle}
                  style={[styles.chip, { backgroundColor: face }, on && styles.chipOn, !idle && styles.chipDim]}
                >
                  <Text style={[styles.chipVal, { color: dark ? palette.inverse : palette.ink }]}>{n}</Text>
                </Pressable>
              );
            })}
            <Pressable onPress={() => setHelpOpen(true)} style={styles.gear}>
              <Text style={styles.gearText}>+</Text>
            </Pressable>
          </View>
          <Text style={styles.room}>
            {t('stud.table_id')} · {STUD_UI_REV}
          </Text>
        </View>
      </View>

      <GameModal
        visible={helpOpen}
        title={t('stud.help_title')}
        body={helpBody}
        confirmLabel={t('common.ok')}
        onConfirm={() => setHelpOpen(false)}
      />
    </SafeAreaView>
  );
}

function IconBtn({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={8} style={styles.iconBtn}>
      <Text style={styles.iconTxt}>{label}</Text>
    </Pressable>
  );
}

function Stat({
  label,
  value,
  align = 'left',
}: {
  label: string;
  value: string;
  align?: 'left' | 'right';
}) {
  return (
    <View style={[styles.stat, align === 'right' && styles.statRight]}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

function BetSpot({
  label,
  onPress,
  active,
  stacked,
  disabled,
  size = 72,
}: {
  label: string;
  onPress: () => void;
  active?: boolean;
  stacked?: number;
  disabled?: boolean;
  size?: number;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled && !active}
      style={[styles.spotWrap, { width: size + 24 }]}
    >
      <View
        style={[
          styles.spot,
          { width: size, height: size, borderRadius: size / 2 },
          active && styles.spotActive,
        ]}
      >
        {stacked != null ? (
          <View style={[styles.spotChip, { backgroundColor: chipColor(stacked) }]}>
            <Text
              style={[
                styles.spotChipText,
                stacked >= 5 && { color: palette.inverse },
              ]}
            >
              {stacked}
            </Text>
          </View>
        ) : (
          <Text style={styles.spotInner} numberOfLines={2}>
            {label}
          </Text>
        )}
      </View>
      <Text style={styles.spotCaption}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: palette.studFelt,
    alignItems: 'center',
  },
  phone: {
    flex: 1,
    maxWidth: 430,
    paddingHorizontal: spacing.md,
  },
  loading: {
    ...typography.body,
    color: palette.studInk,
    textAlign: 'center',
    marginTop: 48,
  },
  iconBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  iconBarRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  iconBtn: {
    minWidth: 36,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconTxt: { color: palette.studInk, fontSize: 16, fontWeight: '700' },
  stats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacing.sm,
  },
  stat: { width: '50%', marginBottom: 6 },
  statRight: { alignItems: 'flex-end' },
  statLabel: { ...typography.micro, color: palette.studMuted },
  statValue: { ...typography.caption, color: palette.studInk, fontWeight: '700' },
  limits: { alignItems: 'center', marginTop: spacing.sm, marginBottom: spacing.sm },
  limitLine: { ...typography.micro, color: palette.studInk, fontWeight: '600' },
  banner: {
    alignSelf: 'center',
    backgroundColor: palette.studBanner,
    paddingHorizontal: 22,
    paddingVertical: 8,
    borderRadius: 999,
    maxWidth: '100%',
  },
  bannerText: {
    ...typography.micro,
    color: palette.studFeltDeep,
    fontWeight: '700',
    textAlign: 'center',
  },
  cardLane: { alignItems: 'center', marginTop: spacing.sm, gap: 4 },
  cardLaneSpacer: { height: 12 },
  laneLabel: { ...typography.micro, color: palette.studMuted },
  cardRow: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap' },
  heroTitle: {
    marginTop: spacing.md,
    textAlign: 'center',
    color: palette.studInk,
    fontSize: 22,
    lineHeight: 26,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  heroSub: {
    ...typography.micro,
    color: palette.studMuted,
    textAlign: 'center',
    marginTop: 4,
  },
  spots: { alignItems: 'center', marginTop: spacing.md, gap: 6 },
  spotRow: { flexDirection: 'row', alignItems: 'center' },
  spotLine: { width: 28, height: 2, backgroundColor: palette.studLine, opacity: 0.7 },
  spotWrap: { alignItems: 'center' },
  spot: {
    borderWidth: 2,
    borderColor: palette.studLine,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  spotActive: {
    borderColor: '#FFFFFF',
    shadowColor: '#FFFFFF',
    shadowOpacity: 0.45,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
  spotInner: {
    ...typography.micro,
    color: palette.studInk,
    textAlign: 'center',
    fontWeight: '700',
    paddingHorizontal: 6,
  },
  spotCaption: {
    ...typography.micro,
    color: palette.studInk,
    marginTop: 4,
    fontWeight: '600',
    textAlign: 'center',
  },
  spotChip: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  spotChipText: { fontSize: 11, fontWeight: '800', color: palette.ink },
  outcome: {
    ...typography.caption,
    color: palette.studInk,
    textAlign: 'center',
    marginTop: 4,
    fontWeight: '700',
  },
  errorTap: { alignItems: 'center', marginTop: spacing.sm },
  error: { ...typography.caption, color: '#FFE4E6', textAlign: 'center' },
  retry: { ...typography.micro, color: palette.studInk, marginTop: 4, fontWeight: '700' },
  foldBtn: {
    alignSelf: 'center',
    marginTop: spacing.sm,
    minHeight: 44,
    paddingHorizontal: 20,
    justifyContent: 'center',
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: '#FFE4E6',
  },
  foldText: { color: '#FFE4E6', fontWeight: '800', fontSize: 14 },
  rail: {
    marginTop: 'auto',
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    borderTopWidth: 8,
    borderTopColor: '#C4A574',
    backgroundColor: palette.studFeltDeep,
    marginHorizontal: -spacing.md,
    paddingHorizontal: spacing.md,
  },
  chipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  chip: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 3,
    borderColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipOn: {
    transform: [{ translateY: -4 }],
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  chipDim: { opacity: 0.45 },
  chipVal: { fontSize: 13, fontWeight: '800' },
  gear: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gearText: { color: palette.studInk, fontSize: 18 },
  room: {
    ...typography.micro,
    color: palette.studMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});
