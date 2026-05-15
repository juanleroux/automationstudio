using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace TagCreator
{
    public class DataType
    {
        public int Id { get;set; }
        public string Name { get;set; }
    }

    public class DataTypes : ObservableCollection<DataType>
    {
        public const int None = 0;
        public const int Bool = 1;
        public const int Int_8 = 2;
        public const int Int_16 = 3;
        public const int Int_32 = 4;
        public const int UInt_8 = 5;
        public const int UInt_16 = 6;
        public const int UInt_32 = 7;
        public const int Float = 8;
        public const int String = 9;
		public const int Int_4 = 10;

		public DataTypes() : base() 
        {
            this.Add(new DataType() { Id = None, Name = "None" });
            this.Add(new DataType() { Id = Bool, Name = "Bool" });
            this.Add(new DataType() { Id = Int_8, Name = "Int_8" });
            this.Add(new DataType() { Id = Int_16, Name = "Int_16" });
            this.Add(new DataType() { Id = Int_32, Name = "Int_32" });
            this.Add(new DataType() { Id = UInt_8, Name = "UInt_8" });
            this.Add(new DataType() { Id = UInt_16, Name = "UInt_16" });
            this.Add(new DataType() { Id = UInt_32, Name = "UInt_32" });
            this.Add(new DataType() { Id = Float, Name = "Float" });
            this.Add(new DataType() { Id = String, Name = "String" });
			this.Add(new DataType() { Id = Int_4, Name = "Int_4" });
		}

        public static int Parse(string dataTypeString)
        {
            if (dataTypeString.Equals("None", StringComparison.OrdinalIgnoreCase))
                return None;

            if (dataTypeString.Equals("Bool", StringComparison.OrdinalIgnoreCase) || dataTypeString.Equals("Boolean", StringComparison.OrdinalIgnoreCase))
				return Bool;

            if (dataTypeString.Equals("Int_8", StringComparison.OrdinalIgnoreCase) || dataTypeString.Equals("Int8", StringComparison.OrdinalIgnoreCase))
				return Int_8;

            if (dataTypeString.Equals("Int_16", StringComparison.OrdinalIgnoreCase) || dataTypeString.Equals("Float8", StringComparison.OrdinalIgnoreCase))
				return Int_16;

            if (dataTypeString.Equals("Int_32", StringComparison.OrdinalIgnoreCase))
                return Int_32;

            if (dataTypeString.Equals("UInt_8", StringComparison.OrdinalIgnoreCase))
                return UInt_8;

            if (dataTypeString.Equals("UInt_16", StringComparison.OrdinalIgnoreCase))
                return UInt_16;

            if (dataTypeString.Equals("UInt_32", StringComparison.OrdinalIgnoreCase))
                return UInt_32;

            if (dataTypeString.Equals("Float", StringComparison.OrdinalIgnoreCase) || dataTypeString.Equals("Float4", StringComparison.OrdinalIgnoreCase))
				return Float;

            if (dataTypeString.Equals("String", StringComparison.OrdinalIgnoreCase))
                return String;

			if (dataTypeString.Equals("Int_4", StringComparison.OrdinalIgnoreCase) || dataTypeString.Equals("Int4", StringComparison.OrdinalIgnoreCase) || dataTypeString.Equals("Integer", StringComparison.OrdinalIgnoreCase))
				return Int_4;

			return -1;
        }
    }

    public class ProfileExportType
    {
        public int Id { get;set; }
        public string Name { get;set; }    
    }

    public class ProfileExportTypes : ObservableCollection<ProfileExportType>
    {
        public const int Tabular = 0;
        public const int Structural = 1;

        public ProfileExportTypes() : base()
        {
            this.Add(new ProfileExportType() { Id = Tabular, Name = "Tabular" });
            this.Add(new ProfileExportType() { Id = Structural, Name = "Structural" });            
        }        
    }

    public class ProfileFormatType
    {
        public int Id { get;set; }
        public string Name { get;set; }
        public string FileDialogFilter { get;set; }        
    }

    public class ProfileFormatTypes : ObservableCollection<ProfileFormatType>
    {
        public const int CSV = 0;
        public const int Text = 1;
        public const int XML = 2;
        public const int Custom = 3;

        public ProfileFormatTypes()
            : base()
        {
            this.Add(new ProfileFormatType() { Id = CSV, Name = "CSV", FileDialogFilter = "CSV Files (*.csv)|*.csv" });
            this.Add(new ProfileFormatType() { Id = Text, Name = "Text", FileDialogFilter = "Text Files (*.txt)|*.txt" });
            this.Add(new ProfileFormatType() { Id = XML, Name = "XML", FileDialogFilter = "XML Files (*.xml)|*.xml" });
            this.Add(new ProfileFormatType() { Id = Custom, Name = "Custom", FileDialogFilter = "Custom Files (*.xxx)|*.xxx" });
        }
    }
}
