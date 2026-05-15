using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.IO;
using System.Xml.Serialization;
using gTools.Log;
using System.ComponentModel;

namespace TagCreator
{
    [XmlRoot(ElementName = "TagCreatorConfiguration", DataType = "string", IsNullable = false)]
    public class Configuration
    {
        private string _filePath;
        
        [XmlIgnore]
        public string FilePath
        {
            get
            {
                return _filePath;
            }
            set
            {
                _filePath = value;
            }
        }

        [XmlIgnore]
        public string Name
        {
            get
            {
                return Path.GetFileNameWithoutExtension(_filePath);
            }
        }

        [XmlElement]
        public ProposalConfiguration Proposal { get; set; }

        //[XmlElement]
        //public EngineeringConfiguration Engineering { get; set; }

        public Configuration()
        {
            Proposal = new ProposalConfiguration();
            //Engineering = new EngineeringConfiguration();  
        }

        #region file management

        public static Configuration Load(string filePath)
        {            
            try
            {
                Configuration configuration = new Configuration();
                if (File.Exists(filePath) == false)
                {
                    configuration.FilePath = filePath;
                    return configuration;
                }

                XmlSerializer xs = new XmlSerializer(typeof(Configuration));
                StreamReader sr = new StreamReader(filePath);
                configuration = (Configuration)xs.Deserialize(sr);
                sr.Close();

                configuration.FilePath = filePath;

                return configuration;
            }
            catch (Exception ex)
            {
                gLog.Error(ex.ToString());
            }

            return null;
        }

        public void Save()
        {
            XmlSerializer xs = new XmlSerializer(typeof(Configuration));

            XmlSerializerNamespaces ns = new XmlSerializerNamespaces();
            ns.Add(string.Empty, "http://www.soneta.pl/schema/business");

            //XmlWriterSettings xws = new XmlWriterSettings();
            //xws.OmitXmlDeclaration = true;
            //XmlWriter xw = XmlWriter.Create(path, xws);

            StreamWriter sw = new StreamWriter(FilePath, false, Encoding.UTF8);
            xs.Serialize(sw, this, ns);
            sw.Close();
        }

        #endregion
    }

    public class ProposalConfiguration : INotifyPropertyChanged
    {
        public event PropertyChangedEventHandler PropertyChanged;

        private string _logoFilePath;        
        private string _previewBodyColor = "#FFFFFF";
        private string _previewHeaderColor = "#528ED2";
        private string _previewFooterColor = "#DDDDDD";
        private string _previewSummaryColor = "#AAAAAA";

        [XmlElement]
        public string Name { get; set; }

        [XmlElement]
        public string Description { get; set; }

        [XmlElement]
        public string CompanyName { get; set; }

        [XmlElement]
        public string ContactName { get; set; }

        [XmlElement]
        public string PhoneNumber { get; set; }

        [XmlElement]
        public string EmailAddress { get; set; }

        [XmlElement]
        public string Address { get; set; }

        [XmlElement]
        public string TaxNumber { get; set; }

        [XmlElement]
        public string CurrencySymbol { get; set; }
        
        [XmlElement]
        public string TaxAmount { get; set; }

        [XmlElement]
        public string LogoFilePath
        {
            get
            {
                return _logoFilePath;
            }
            set
            {
                _logoFilePath = value;
                NotifyPropertyChanged("LogoFilePath");
            }
        }        

        [XmlElement]
        public string PreviewBodyColor 
        {
            get
            {
                return _previewBodyColor;
            }
            set
            {
                _previewBodyColor = value;                
                NotifyPropertyChanged("PreviewBodyColor");                
            }
        }

        [XmlElement]
        public string PreviewHeaderColor
        {
            get
            {
                return _previewHeaderColor;
            }
            set
            {
                _previewHeaderColor = value;
                NotifyPropertyChanged("PreviewHeaderColor");
            }
        }

        [XmlElement]
        public string PreviewFooterColor
        {
            get
            {
                return _previewFooterColor;
            }
            set
            {
                _previewFooterColor = value;
                NotifyPropertyChanged("PreviewFooterColor");
            }
        }

        [XmlElement]
        public string PreviewSummaryColor
        {
            get
            {
                return _previewSummaryColor;
            }
            set
            {
                _previewSummaryColor = value;
                NotifyPropertyChanged("PreviewSummaryColor");
            }
        }

        [XmlElement]
        public DateTime LastModification { get; set; }

        public ProposalConfiguration() { }

        private void NotifyPropertyChanged(String property)
        {
            if (PropertyChanged != null)
            {
                PropertyChanged(this, new PropertyChangedEventArgs(property));
            }
        }

        public void UpdateLastModification()
        {
            LastModification = DateTime.Now;
        }
    }

    //public class EngineeringConfiguration : INotifyPropertyChanged
    //{
    //    public event PropertyChangedEventHandler PropertyChanged;
               
    //    public EngineeringConfiguration() { }

    //    private void NotifyPropertyChanged(String property)
    //    {
    //        if (PropertyChanged != null)
    //        {
    //            PropertyChanged(this, new PropertyChangedEventArgs(property));
    //        }
    //    }       
    //}

}
