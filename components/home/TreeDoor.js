import Link from "next/link";
import { forwardRef } from "react";
import { DOOR_ICONS, IconArrow } from "./DoorIcons";
import styles from "./TreeDoor.module.css";

const ROW_ENTRANCE_BASE_MS = 680;
const ROW_ENTRANCE_STAGGER_MS = 140;

const TreeDoor = forwardRef(function TreeDoor(
  {
    href,
    category,
    qualifier,
    dateLine,
    doorId,
    entranceIndex,
    skipEntrance,
    animate,
  },
  ref
) {
  const Icon = DOOR_ICONS[doorId];

  const entranceClass = skipEntrance
    ? styles.rowVisible
    : animate
      ? styles.rowEnter
      : styles.rowHidden;

  const entranceStyle =
    skipEntrance || !animate
      ? undefined
      : {
          animationDelay: `${ROW_ENTRANCE_BASE_MS + entranceIndex * ROW_ENTRANCE_STAGGER_MS}ms`,
        };

  return (
    <Link
      ref={ref}
      href={href}
      id={`tree-door-${doorId}`}
      className={`${styles.row} ${entranceClass}`}
      style={entranceStyle}
    >
      <span className={styles.iconWrap} aria-hidden="true">
        {Icon ? <Icon className={styles.icon} /> : null}
      </span>
      <span className={styles.textBlock}>
        <span className={styles.category}>{category}</span>
        <span className={styles.qualifier}>{qualifier}</span>
        {dateLine ? <span className={styles.dateLine}>{dateLine}</span> : null}
      </span>
      <span className={styles.arrowWrap} aria-hidden="true">
        <IconArrow className={styles.arrow} />
      </span>
    </Link>
  );
});

export default TreeDoor;
