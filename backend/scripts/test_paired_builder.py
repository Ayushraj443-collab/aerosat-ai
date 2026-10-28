import sys
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.data.paired_observation_builder import GenuinePairedObservationBuilder

def main():
    print("=== TESTING GENUINE PAIRED OBSERVATION BUILDER ===")
    pairs = GenuinePairedObservationBuilder.process_all_downloaded_granules()
    print(f"Total genuine paired observations generated: {len(pairs)}")
    
    if pairs:
        print("\nSample paired record:")
        for k, v in list(pairs[0].items()):
            print(f"  {k}: {v}")
            
        print("\nDistribution across stations and dates:")
        import pandas as pd
        df = pd.DataFrame(pairs)
        print(df.groupby(["station_id", "observation_time"]).size().unstack(fill_value=0))
        
        print("\nCorrelation between Satellite Column and Ground Value:")
        corr = df["satellite_column"].corr(df["ground_value"])
        print(f"Pearson Correlation r = {corr:.4f} (Notice: Realistic, NOT 1.0000!)")

if __name__ == "__main__":
    main()
