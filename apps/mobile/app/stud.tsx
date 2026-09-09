import { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  actStudHand,
  formatApiError,
  getStudConfig,
  getStudHand,
  startStudHand,
  type StudHandView,
} from '../src/api/client';
import { PlayingCard } from '../src/components/ui/PlayingCard';
import { Screen } from '../src/components/ui/Screen';
import { Button } from '../src/components/ui/Button';
import { GameModal } from '../src/components/ui/GameModal';
import { colors, palette, radius, spacing, typography } from '../src/theme';

const DEFAULT_ANTES = [1, 2, 5, 10, 20];

function signed(n: number): string {
  if (n > 0) return `+${n.toLocaleString()}`;
  return n.toLocaleString();
}

export default function CaribbeanStudScreen() {
  const { t } = useTranslation();
  const router = useRouter();
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
  const [error, setError] = useState<string | null>(null);

  const boot = useCallback(async () => {
    try {
      const [cfg, open] = await Promise.all([getStudConfig(), getStudHand()]);
      setAntes(cfg.anteOptions.length ? cfg.anteOptions : DEFAULT_ANTES);
      setPaytable(cfg.paytable);
      setBalance(open.chipsBalance);
      setHand(open.hand);
      if (open.hand?.ante) setAnte(open.hand.ante);
    } catch (e) {
      setError(formatApiError((e as Error).message, t));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
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
      setError(formatApiError((e as Error).message, t));
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

  const outcomeText = () => {
    const r = hand?.result;
    if (!r) return '';
    if (r.outcome === 'fold') return t('stud.outcome_fold', { ante: hand?.ante });
    if (r.outcome === 'dealer_no_qualify') return t('stud.outcome_no_qualify');
    if (r.outcome === 'player_win') return t('stud.outcome_win', { odds: r.anteOdds });
    if (r.outcome === 'dealer_win') return t('stud.outcome_lose');
    return t('stud.outcome_push');
  };

  const settled = hand?.phase === 'SETTLED';
  const canRaise = deciding && balance >= (hand?.raiseToCall ?? ante * 2);

  if (loading) {
    return <Screen loading loadingLabel={t('common.loading')} />;
  }

  return (
    <Screen>
      <View style={styles.top}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Text style={styles.back}>← {t('stud.back')}</Text>
        </Pressable>
        <View style={styles.topCenter}>
          <Text style={styles.title}>{t('stud.title')}</Text>
          <Text style={styles.meta}>
            {t('lobby.balance')} {balance.toLocaleString()} · {t('stud.session_net', { net: signed(sessionNet) })}
            {hands > 0 ? ` · ${t('stud.hands', { n: hands })}` : ''}
          </Text>
        </View>
        <Pressable onPress={() => setHelpOpen(true)} hitSlop={10}>
          <Text style={styles.help}>{t('stud.help')}</Text>
        </Pressable>
      </View>

      <Text style={styles.qualify}>{t('stud.qualify')}</Text>

      <View style={styles.felt}>
        <Text style={styles.laneLabel}>{t('stud.dealer')}</Text>
        <View style={styles.row}>
          {(hand?.dealerCards ?? ['**', '**']).map((code, i) => (
            <PlayingCard key={`d-${i}`} code={code || '**'} size="md" faceDown={!code || code === '**'} />
          ))}
        </View>
        <Text style={styles.laneLabel}>{t('stud.board')}</Text>
        <View style={styles.row}>
          {(hand?.community ?? ['', '', '', '', '']).map((code, i) => (
            <PlayingCard key={`c-${i}`} code={code || '**'} size="sm" faceDown={!code} />
          ))}
        </View>
        <Text style={styles.laneLabel}>{t('stud.player')}</Text>
        <View style={styles.row}>
          {(hand?.playerCards ?? ['**', '**']).map((code, i) => (
            <PlayingCard key={`p-${i}`} code={code || '**'} size="lg" faceDown={!code || code === '**'} />
          ))}
        </View>
        {settled ? <Text style={styles.outcome}>{outcomeText()}</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>

      {!hand || settled ? (
        <View style={styles.controls}>
          <Text style={styles.laneLabel}>{t('stud.ante')}</Text>
          <View style={styles.chipRow}>
            {antes.map((n) => (
              <Pressable
                key={n}
                onPress={() => setAnte(n)}
                style={[styles.chip, ante === n && styles.chipOn]}
              >
                <Text style={[styles.chipText, ante === n && styles.chipTextOn]}>{n}</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.actionRow}>
            {settled ? (
              <Button
                label={t('stud.repeat')}
                onPress={() => {
                  setAnte(hand.ante);
                  void run(() => startStudHand(hand.ante));
                }}
                loading={busy}
                disabled={busy || balance < hand.ante}
                style={styles.actionBtn}
              />
            ) : null}
            <Button
              label={t('stud.deal')}
              onPress={onDeal}
              loading={busy}
              disabled={busy || balance < ante}
              style={styles.actionBtn}
            />
          </View>
        </View>
      ) : (
        <View style={styles.actionRow}>
          <Button
            label={t('stud.fold')}
            variant="danger"
            onPress={() => void run(() => actStudHand('fold'))}
            loading={busy}
            disabled={busy}
            style={styles.actionBtn}
          />
          <Button
            label={t('stud.raise', { amount: hand.raiseToCall })}
            onPress={() => void run(() => actStudHand('raise'))}
            loading={busy}
            disabled={busy || !canRaise}
            style={styles.actionBtn}
          />
        </View>
      )}

      <GameModal
        visible={helpOpen}
        title={t('stud.help_title')}
        body={`${t('stud.rule_1')}\n${t('stud.rule_2')}\n${t('stud.rule_3')}\n${t('stud.rule_4')}\n${t('stud.rule_5')}\n\n${t('stud.paytable')}\n${paytable
          .map((row) => `${t(`stud.cat_${row.category}`)}  1:${row.odds}`)
          .join('\n')}`}
        confirmLabel={t('common.ok')}
        onConfirm={() => setHelpOpen(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  back: { ...typography.caption, color: colors.brand.secondary },
  help: { ...typography.caption, color: colors.brand.secondary },
  topCenter: { flex: 1, alignItems: 'center', paddingHorizontal: spacing.sm },
  title: { ...typography.h2, color: colors.text.primary },
  meta: { ...typography.micro, color: colors.text.secondary, marginTop: 2 },
  qualify: {
    ...typography.micro,
    color: colors.brand.secondary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  felt: {
    flex: 1,
    backgroundColor: palette.accentSoft,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.line,
    padding: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  laneLabel: { ...typography.micro, color: colors.text.secondary },
  row: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap', justifyContent: 'center' },
  outcome: { ...typography.caption, color: colors.text.primary, textAlign: 'center', marginTop: spacing.sm },
  error: { ...typography.caption, color: colors.semantic.danger, textAlign: 'center' },
  controls: { marginTop: spacing.md, gap: spacing.sm },
  chipRow: { flexDirection: 'row', gap: spacing.sm, justifyContent: 'center', flexWrap: 'wrap' },
  chip: {
    minWidth: 48,
    minHeight: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.inverse,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  chipOn: { backgroundColor: colors.brand.primary, borderColor: colors.brand.primary },
  chipText: { ...typography.caption, color: colors.text.primary, fontWeight: '700' },
  chipTextOn: { color: palette.inverse },
  actionRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  actionBtn: { flex: 1 },
});
