import Calendar from "../components/Calendar";
import FloatingDaySummary from "../components/FloatingDaySummary";
import styles from './Tasks.module.css';

export default function Tasks() {
    return (
        <div className={styles.pageContainer}>
            <Calendar />
            <FloatingDaySummary />
        </div>
    )
}