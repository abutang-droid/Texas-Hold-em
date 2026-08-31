import { View, Text, Pressable, StyleSheet, Modal } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { SeatView } from './Table9Max';
import { colors, palette, radius } from '../theme';

export interface RebuyApproval {
  requestId: string;
  userId: string;
  nickname: string;
  amount: number;
  deadline: number;
}

export interface DissolveVoteState {
  initiatedBy: string;
  deadline: number;
  requiredApprovals: number;
  currentApprovals: number;
  seatedCount: number;
}

interface PrivateTablePanelsProps {
  isPrivate: boolean;
  isHost: boolean;
  paused: boolean;
  buyInCap: number;
  myChips: number;
  humanSeats: SeatView[];
  rebuyApproval: RebuyApproval | null;
  dissolveVote: DissolveVoteState | null;
  onRequestRebuy: () => void;
  onApproveRebuy: () => void;
  onRejectRebuy: () => void;
  onDissolveApprove: () => void;
  onDissolveReject: () => void;
  onPause: () => void;
  onResume: () => void;
  onStartDissolve: () => void;
  onKick: (userId: string) => void;
  onReport: (userId: string) => void;
}

export function PrivateTablePanels({
  isPrivate,
  isHost,
  paused,
  buyInCap,
  myChips,
  humanSeats,
  rebuyApproval,
  dissolveVote,
  onRequestRebuy,
  onApproveRebuy,
  onRejectRebuy,
  onDissolveApprove,
  onDissolveReject,
  onPause,
  onResume,
  onStartDissolve,
  onKick,
  onReport,
}: PrivateTablePanelsProps) {
  const { t } = useTranslation();

  if (!isPrivate) return null;

  const secondsLeft = (deadline: number) => Math.max(0, Math.ceil((deadline - Date.now()) / 1000));

  return (
    <>
      {paused && (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>{t('table.paused')}</Text>
        </View>
      )}

      <View style={styles.toolbar}>
        {!isHost && myChips < buyInCap && (
          <Pressable style={styles.toolBtn} onPress={onRequestRebuy}>
            <Text style={styles.toolText}>{t('table.rebuy')}</Text>
          </Pressable>
        )}

        {isHost && (
          <>
            <Pressable style={styles.toolBtn} onPress={paused ? onResume : onPause}>
              <Text style={styles.toolText}>{paused ? t('table.resume') : t('table.pause')}</Text>
            </Pressable>
            <Pressable style={styles.toolBtn} onPress={onStartDissolve}>
              <Text style={styles.toolText}>{t('table.dissolve')}</Text>
            </Pressable>
          </>
        )}
      </View>

      {isHost && humanSeats.length > 0 && (
        <View style={styles.hostPanel}>
          {humanSeats.map((seat) => (
            <View key={seat.userId} style={styles.hostRow}>
              <Text style={styles.hostName} numberOfLines={1}>
                {seat.nickname}
              </Text>
              {seat.userId !== undefined && (
                <>
                  <Pressable style={styles.hostAction} onPress={() => onKick(seat.userId!)}>
                    <Text style={styles.hostActionText}>{t('table.kick')}</Text>
                  </Pressable>
                  <Pressable style={styles.hostAction} onPress={() => onReport(seat.userId!)}>
                    <Text style={styles.hostActionText}>{t('table.report')}</Text>
                  </Pressable>
                </>
              )}
            </View>
          ))}
        </View>
      )}

      <Modal visible={!!rebuyApproval && isHost} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t('table.rebuy_approval_title')}</Text>
            <Text style={styles.modalBody}>
              {t('table.rebuy_approval_body', {
                name: rebuyApproval?.nickname,
                amount: rebuyApproval?.amount,
                seconds: rebuyApproval ? secondsLeft(rebuyApproval.deadline) : 0,
              })}
            </Text>
            <View style={styles.modalActions}>
              <Pressable style={styles.rejectBtn} onPress={onRejectRebuy}>
                <Text style={styles.rejectText}>{t('table.reject')}</Text>
              </Pressable>
              <Pressable style={styles.approveBtn} onPress={onApproveRebuy}>
                <Text style={styles.approveText}>{t('table.approve')}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={!!dissolveVote} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t('table.dissolve_vote_title')}</Text>
            <Text style={styles.modalBody}>
              {t('table.dissolve_vote_body', {
                current: dissolveVote?.currentApprovals ?? 0,
                required: dissolveVote?.requiredApprovals ?? 0,
                seconds: dissolveVote ? secondsLeft(dissolveVote.deadline) : 0,
              })}
            </Text>
            <View style={styles.modalActions}>
              <Pressable style={styles.rejectBtn} onPress={onDissolveReject}>
                <Text style={styles.rejectText}>{t('table.reject')}</Text>
              </Pressable>
              <Pressable style={styles.approveBtn} onPress={onDissolveApprove}>
                <Text style={styles.approveText}>{t('table.approve')}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 48,
    alignSelf: 'center',
    backgroundColor: '#B71C1C',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 6,
    zIndex: 10,
  },
  bannerText: { color: '#fff', fontWeight: '700' },
  toolbar: {
    position: 'absolute',
    top: 16,
    right: 16,
    flexDirection: 'row',
    gap: 8,
    zIndex: 10,
  },
  toolBtn: {
    backgroundColor: palette.inverse,
    borderColor: palette.line,
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
    minHeight: 44,
    justifyContent: 'center',
  },
  toolText: { color: colors.brand.primary, fontSize: 12, fontWeight: '700' },
  hostPanel: {
    position: 'absolute',
    top: 56,
    left: 16,
    maxWidth: 200,
    zIndex: 9,
    gap: 4,
  },
  hostRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  hostName: { color: colors.text.secondary, fontSize: 11 },
  hostAction: {
    backgroundColor: palette.inverse,
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: palette.line,
  },
  hostActionText: { color: colors.text.primary, fontSize: 10, fontWeight: '600' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: palette.inverse,
    borderRadius: radius.lg,
    padding: 20,
    width: '100%',
    maxWidth: 360,
    borderWidth: 1,
    borderColor: palette.line,
  },
  modalTitle: { color: colors.text.primary, fontSize: 18, fontWeight: '800', marginBottom: 12 },
  modalBody: { color: colors.text.secondary, lineHeight: 22, marginBottom: 20 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
  rejectBtn: {
    borderWidth: 1,
    borderColor: palette.line,
    borderRadius: radius.md,
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 44,
    justifyContent: 'center',
  },
  rejectText: { color: colors.text.secondary, fontWeight: '700' },
  approveBtn: {
    backgroundColor: colors.brand.primary,
    borderRadius: radius.md,
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 44,
    justifyContent: 'center',
  },
  approveText: { color: palette.inverse, fontWeight: '800' },
});
