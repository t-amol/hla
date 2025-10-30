import mlflow, pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import roc_auc_score

def main():
    X = pd.read_csv("metadata/seed/observations.csv").pivot_table(
        index="patient", columns="code", values="value", aggfunc="mean").fillna(0)
    y = (X.get("BP_SYS", 0) > 130).astype(int)
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    mlflow.set_tracking_uri("http://localhost:5000")
    mlflow.set_experiment("readmissions")
    with mlflow.start_run():
        clf = LogisticRegression(max_iter=200).fit(X_train, y_train)
        auc = roc_auc_score(y_test, clf.predict_proba(X_test)[:,1])
        mlflow.log_metric("auc", auc)
        mlflow.sklearn.log_model(clf, "model")
        print("AUC:", auc)

if __name__ == "__main__":
    main()
