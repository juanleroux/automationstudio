using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Linq;
using System.Text;
using System.Xml;
using System.Xml.Schema;
using System.Xml.Serialization;
using System.IO;
using System.Reflection;
using System.ComponentModel;
using gTools.Log;

namespace TagCreator
{
    [XmlRoot(ElementName = "TagCreator", DataType = "string", IsNullable = false)]    
    public class Project
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
        public Templates Templates { get; set; }

        [XmlElement]
        public Areas Areas { get; set; }

        [XmlElement]
        public Proposal Proposal { get; set; }

        [XmlElement]
        public Engineering Engineering { get; set; }

        public Project()
        {
            Templates = new Templates();
            Areas = new Areas();
            Proposal = new Proposal();
            Engineering = new Engineering();
        }

        #region file management

        public static Project Load(string filePath)
        {
            try
            {
                XmlSerializer xs = new XmlSerializer(typeof(Project));
                StreamReader sr = new StreamReader(filePath);
                Project project = (Project)xs.Deserialize(sr);                
                sr.Close();

                project.FilePath = filePath;

                //verify unassigned area
                if (project.Areas.Items.Count(u => u.Id == 0) == 0)
                    project.Areas.AddArea(new Area() { Name = "Unassigned"}, 0);

                //add instance to areas
                foreach (Template template in project.Templates.Items)
                {
                    foreach (Instance instance in template.Instances.Items)
                    {
                        Area area = project.Areas.Items.Where(u => u.Id == instance.AreaId).SingleOrDefault();
                        if (area != null)
                            area.Instances.Items.Add(instance);
                        else
                            project.Areas.Items.Where(u => u.Id == 0).Single().Instances.Items.Add(instance);
                    }
                }

                return project;
            }
            catch (Exception ex)
            {
                gLog.Error(ex.ToString());
            }

            return null;
        }

        public void Save()
        {
            XmlSerializer xs = new XmlSerializer(typeof(Project));
            
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

    [XmlRoot(ElementName = "ProposalExport", DataType = "string", IsNullable = false)]
    public class ProposalExport
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
        
        [XmlElement]
        public Proposal Proposal { get; set; }

        public ProposalExport()
        {
            Proposal = new Proposal();
        }

        #region file management

        public static ProposalExport Load(string filePath)
        {
            try
            {
                XmlSerializer xs = new XmlSerializer(typeof(ProposalExport));
                StreamReader sr = new StreamReader(filePath);
                ProposalExport proposalExport = (ProposalExport)xs.Deserialize(sr);
                sr.Close();

                proposalExport.FilePath = filePath;

                return proposalExport;
            }
            catch (Exception ex)
            {
                gLog.Error(ex.ToString());
            }

            return null;
        }

        public void Save()
        {
            XmlSerializer xs = new XmlSerializer(typeof(ProposalExport));

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

    #region Engineering

    public class Engineering : INotifyPropertyChanged
    {
        public event PropertyChangedEventHandler PropertyChanged;

		private string _ignitionGateway;
		private string _apiKey;
		private string _folderPath;


		[XmlElement]
		public bool EnableIgnitionMenuItems { get; set; } = true;

		[XmlElement]
		public string IgnitionGateway
		{
			get
			{
				return _ignitionGateway;
			}
			set
			{
				_ignitionGateway = value;
				NotifyPropertyChanged("IgnitionGateway");
			}
		}

		[XmlElement]
		public string APIKey
		{
			get
			{
				return _apiKey;
			}
			set
			{
				_apiKey = value;
				NotifyPropertyChanged("APIKey");
			}
		}

		[XmlElement]
        public string FolderPath
        {
            get
            {
                return _folderPath;
            }
            set
            {
                _folderPath = value;
                NotifyPropertyChanged("FolderPath");
            }
        }

        public Engineering(){}
        
        private void NotifyPropertyChanged(String property)
        {
            if (PropertyChanged != null)
            {
                PropertyChanged(this, new PropertyChangedEventArgs(property));
            }
        }
    }

    public class Templates
    {
        [XmlElement(ElementName = "Template")]
        public ObservableCollection<Template> Items { get; set; }

        public Templates()
        {
            Items = new ObservableCollection<Template>();
        }

        public void AddTemplate(Template template)
        {
            template.Id = GetNextId();
            Items.Add(template);
            template.UpdateLastModification();
        }

        public int GetNextId()
        {
            return Items.Count > 0 ? Items.Max(u => u.Id) + 1 : 1;
        }
    }

    public class Template : INotifyPropertyChanged
    {
        public event PropertyChangedEventHandler PropertyChanged;

        private string _name;
		private bool _isSelected;
		private bool _isExpanded;
		private bool _isFlaggedHidden;

		[XmlElement]
        public int Id { get; set; }

        [XmlElement]
        public string Name 
        {
            get
            {
                return _name;
            }
            set
            {
                _name = value;
                NotifyPropertyChanged("Name");
            }
        }

        [XmlElement]
        public string Description
        {
            get;
            set;
        }

        [XmlElement]
        public DateTime LastModification
        {
            get;set;            
        }

        [XmlElement]
        public TemplateAttributes Attributes { get; set; }

        [XmlElement]
        public Instances Instances { get; set; }

        [XmlElement]
        public Profiles Profiles { get; set; }

        [XmlIgnore]
        public bool IsSelected
        {
            get
            {
                return _isSelected;
            }
            set
            {
                _isSelected = value;
                NotifyPropertyChanged("IsSelected");
            }
        }

        [XmlIgnore]
        public bool IsFlaggedHidden
        {
            get
            {
                return _isFlaggedHidden;
            }
            set
            {
                _isFlaggedHidden = value;
                NotifyPropertyChanged("IsFlaggedHidden");
            }
        }

        [XmlIgnore]
        public bool IsExpanded
        {
            get
            {
                return _isExpanded;
            }
            set
            {
                _isExpanded = value;
                NotifyPropertyChanged("IsExpanded");
            }
        }

        public Template()
        {
            Attributes = new TemplateAttributes();
            Instances = new Instances();
            Profiles = new Profiles();
        }

        //duplicate constructor
        public Template(Template template)
        {
            Name = template.Name;
            Description = template.Description;

            Attributes = new TemplateAttributes();
            Instances = new Instances();
            Profiles = new Profiles();            

            foreach (TemplateAttribute attribute in template.Attributes.Items)
                AddAttribute(new TemplateAttribute(attribute) { Id = attribute.Id });

            foreach (Instance instance in template.Instances.Items)
                AddInstance(new Instance(instance));

            foreach(Profile profile in template.Profiles.Items)
                AddProfile(new Profile(profile));
        }

        public void AddAttribute(TemplateAttribute attribute)
        {
            try
            {
                Attributes.Items.Add(attribute);

                //add attribute to all instances
                foreach (Instance instance in this.Instances.Items)
                    instance.AddAttribute(new InstanceAttribute() { Id = attribute.Id });

                UpdateLastModification();
            }
            catch (Exception ex)
            {
                gLog.Error(ex.ToString());
            }
        }

        public void RemoveAttribute(TemplateAttribute attribute)
        {
            try
            {
                //remove attribute from all instances
                foreach (Instance instance in this.Instances.Items)
                    instance.RemoveAttribute(instance.Attributes.Items.Where(u => u.Id == attribute.Id).Single());

                Attributes.Items.Remove(attribute);
                UpdateLastModification();
            }
            catch (Exception ex)
            {
                gLog.Error(ex.ToString());
            }
        }

        public void AddInstance(Instance instance)
        {
            instance.Id = Instances.GetNextId();
            Instances.Items.Add(instance);
            instance.UpdateLastModification();
            UpdateLastModification();
        }

        public void RemoveInstance(Instance instance)
        {
            Instances.Items.Remove(instance);
            UpdateLastModification();
        }

        public void AddProfile(Profile profile)
        {
            Profiles.Items.Add(profile);            
            UpdateLastModification();
        }

        public void RemoveProfile(Profile profile)
        {
            Profiles.Items.Remove(profile);
            UpdateLastModification();
        }

        public void AddProfileAttribute(Profile profile, ProfileAttribute attribute)
        {
            try
            {
                profile.Attributes.Items.Add(attribute);                
                UpdateLastModification();
            }
            catch (Exception ex)
            {
                gLog.Error(ex.ToString());
            }
        }

        public void RemoveProfileAttribute(Profile profile, ProfileAttribute attribute)
        {
            try
            {
                profile.Attributes.Items.Remove(attribute);
                UpdateLastModification();
            }
            catch (Exception ex)
            {
                gLog.Error(ex.ToString());
            }
        }

        public void UpdateLastModification()
        {
            LastModification = DateTime.Now;
        }

        private void NotifyPropertyChanged(String property)
        {
            if (PropertyChanged != null)
            {
                PropertyChanged(this, new PropertyChangedEventArgs(property));
            }
        }
    }

    public class TemplateAttributes
    {
        [XmlElement(ElementName = "Attribute")]
        public ObservableCollection<TemplateAttribute> Items { get; set; }

        public TemplateAttributes()
        {
            Items = new ObservableCollection<TemplateAttribute>();
        }

        public int GetNextId()
        {
            return Items.Count > 0 ? Items.Max(u => u.Id) + 1 : 1;
        }
    }

    public abstract class AttributeBase
    {
        [XmlIgnore]
        public abstract bool Parameter { get; set; }
		[XmlIgnore]
        public abstract int Id { get; set; }
        [XmlIgnore]
        public abstract string Name { get; set; }
        [XmlIgnore]
        public abstract string Description { get; set; }
        [XmlIgnore]
        public abstract int DataType { get; set; }
        [XmlIgnore]
        public abstract string Value { get; set; }  
    }

    public class TemplateAttribute : AttributeBase
    {
		[XmlElement]
		public override bool Parameter { get; set; }

		[XmlElement]
        public override int Id { get; set; }

        [XmlElement]
        public override string Name { get; set; }

        [XmlElement]
        public override string Description { get; set; }

        [XmlElement]
        public override int DataType { get; set; }

        [XmlElement]
        public override string Value { get; set; }  //we store as string for compatibility, we'll convert it later      

        public TemplateAttribute() { }

        //duplicate constructor
        public TemplateAttribute(TemplateAttribute attribute)
        {
            foreach (var property in this.GetType().GetProperties(BindingFlags.Public | BindingFlags.Instance | BindingFlags.DeclaredOnly))
            {
                //skip Id
                if (property.Name.Equals("id", StringComparison.OrdinalIgnoreCase))
                    continue;

                object o = property.GetValue(attribute);
                if (property.CanWrite)
                    property.SetValue(this, o);
            }              
        }
    }

    public class InstanceAttribute : AttributeBase
    {
        [XmlElement]
        public override bool Parameter { get; set; }

        [XmlElement]
        public override int Id { get; set; }
        
        [XmlIgnore]
        public override string Name { get; set; }

        [XmlIgnore]
        public override string Description { get; set; }

        [XmlIgnore]
        public override int DataType { get; set; }

        [XmlElement]
        public override string Value { get; set; }  //we store as string for compatibility, we'll convert it later      
        
        public InstanceAttribute() { }
        
        //duplicate constructor
        public InstanceAttribute(InstanceAttribute attribute)
        {
            foreach (var property in this.GetType().GetProperties(BindingFlags.Public | BindingFlags.Instance | BindingFlags.DeclaredOnly))
            {
                object o = property.GetValue(attribute);
                if (property.CanWrite)
                    property.SetValue(this, o);
            }              
        }

		/// <summary>
		///InstanceAttribute has only Id and Value
		///we have to copy other properties from TemplateAttribute (name, desc, data type)                       
		/// </summary>
		public void GetParentsProperties(AttributeBase templateAttribute)
		{
			try
			{
				PropertyInfo[] templateProperties = templateAttribute
					.GetType()
					.GetProperties(BindingFlags.Public | BindingFlags.Instance | BindingFlags.DeclaredOnly);

				foreach (var property in this.GetType()
							 .GetProperties(BindingFlags.Public | BindingFlags.Instance | BindingFlags.DeclaredOnly))
				{
					// Skip Id
					if (property.Name.Equals("Id", StringComparison.OrdinalIgnoreCase))
						continue;

					// 🚨 CRITICAL FIX: NEVER copy Value
					if (property.Name.Equals("Value", StringComparison.OrdinalIgnoreCase))
						continue;

                    // Skips Paramter so it's independent from Template
                    /*if (property.Name.Equals("Parameter", StringComparison.OrdinalIgnoreCase))
                        continue;*/

					var templateProp = templateProperties.SingleOrDefault(u => u.Name == property.Name);
					if (templateProp == null)
						continue;

					object o = templateProp.GetValue(templateAttribute);

					if (property.CanWrite)
						property.SetValue(this, o);
				}
			}
			catch (Exception ex)
			{
				gLog.Error(ex.ToString());
			}
		}
	}

    public class Instances
    {
        [XmlElement(ElementName = "Instance")]
        public ObservableCollection<Instance> Items { get; set; }

        public Instances()
        {
            Items = new ObservableCollection<Instance>();
        }

        public int GetNextId()
        {
            return Items.Count > 0 ? Items.Max(u => u.Id) + 1 : 1;
        }
    }

    public class Instance : INotifyPropertyChanged
    {
        public event PropertyChangedEventHandler PropertyChanged;

        private string _name;

        [XmlElement]
        public int Id { get; set; }

        [XmlElement]
        public int AreaId { get; set; }

        [XmlElement]
        public string Name
        {
            get
            {
                return _name;
            }
            set
            {
                _name = value;
                NotifyPropertyChanged("Name");
            }
        }

        [XmlElement]
        public string Description { get; set; }

        [XmlElement]
        public DateTime LastModification
        {
            get;set;            
        }

        [XmlElement]
        public InstanceAttributes Attributes { get; set; }

        private bool _isSelected;
        private bool _isExpanded;
        private bool _isFlagged;
        private bool _isFlaggedHidden;

        [XmlIgnore]
        public bool IsSelected
        {
            get
            {
                return _isSelected;
            }
            set
            {
                _isSelected = value;
                NotifyPropertyChanged("IsSelected");
            }
        }

        [XmlIgnore]
        public bool IsExpanded
        {
            get
            {
                return _isExpanded;
            }
            set
            {
                _isExpanded = value;
                NotifyPropertyChanged("IsExpanded");
            }
        }

        [XmlElement]
        public bool IsFlagged
        {
            get
            {
                return _isFlagged;
            }
            set
            {
                _isFlagged = value;
                NotifyPropertyChanged("IsFlagged");
            }
        }

        [XmlIgnore]
        public bool IsFlaggedHidden
        {
            get
            {
                return _isFlaggedHidden;
            }
            set
            {
                _isFlaggedHidden = value;
                NotifyPropertyChanged("IsFlaggedHidden");
            }
        }

        public Instance()
        {
            Attributes = new InstanceAttributes();            
        }

        //duplicate constructor
        public Instance(Instance instance)
        {            
            Name = instance.Name;
            Description = instance.Description;
            AreaId = instance.AreaId;

            Attributes = new InstanceAttributes();
            foreach (InstanceAttribute attribute in instance.Attributes.Items)
                AddAttribute(new InstanceAttribute(attribute));            
        }

        //create from string constructor
        public Instance(int[] ids, string[] values)
        {            
            //string[] values = line.Split(new char[] { ',' }, StringSplitOptions.RemoveEmptyEntries);
            Name = values[0].Equals("NULL", StringComparison.OrdinalIgnoreCase) ? string.Empty : values[0];
            Description = values[1].Equals("NULL", StringComparison.OrdinalIgnoreCase) ? string.Empty : values[1];
            
            Attributes = new InstanceAttributes();
            for (int i = 2; i < ids.Length; i++){
				string value = (i < values.Length) ? values[i] : null;

                if (string.Equals(value, "NULL", StringComparison.OrdinalIgnoreCase))
                    value = string.Empty;

				AddAttribute(new InstanceAttribute()
                {
                    Id = ids[i],
                    Value = value
                });
			}
        }

        public void AddAttribute(InstanceAttribute attribute)
        {
            Attributes.Items.Add(attribute);
            UpdateLastModification();
        }

        public void RemoveAttribute(InstanceAttribute attribute)
        {
            Attributes.Items.Remove(attribute);
            UpdateLastModification();
        }

        public void UpdateLastModification()
        {
            LastModification = DateTime.Now;
        }

        private void NotifyPropertyChanged(String property)
        {
            if (PropertyChanged != null)
            {
                PropertyChanged(this, new PropertyChangedEventArgs(property));
            }
        }
    }

    public class InstanceAttributes
    {
        [XmlElement(ElementName = "Attribute")]
        public ObservableCollection<InstanceAttribute> Items { get; set; }

        public InstanceAttributes()
        {
            Items = new ObservableCollection<InstanceAttribute>();
        }
    }

    public class Profiles
    {
        [XmlElement(ElementName = "Profile")]
        public ObservableCollection<Profile> Items { get; set; }

        public Profiles()
        {
            Items = new ObservableCollection<Profile>();
        }
    }

    public class Profile : INotifyPropertyChanged
    {
        public event PropertyChangedEventHandler PropertyChanged;

        [XmlElement]
        public string Name { get; set; }
        [XmlElement]
        public string Description { get; set; }
        [XmlElement]
        public int ExportType { get; set; }
        [XmlElement]
        public string TabularExportDelimiter { get; set; }
        [XmlElement]
        public string StructuralExportTemplate { get; set; }        
        [XmlElement]
        public int FormatType { get; set; }        
        [XmlElement]
        public string CustomFormat { get; set; }        
        
        [XmlElement]
        public ProfileAttributes Attributes { get; set; }

        public Profile()
        {
            TabularExportDelimiter = ",";
            Attributes = new ProfileAttributes();
        }     
        
        //duplicate constructor
        public Profile(Profile profile)
        {
            foreach (var property in this.GetType().GetProperties(BindingFlags.Public | BindingFlags.Instance | BindingFlags.DeclaredOnly))
            {
                object o = property.GetValue(profile);
                if (property.CanWrite)
                    property.SetValue(this, o);
            } 

            Attributes = new ProfileAttributes();
            foreach (ProfileAttribute attribute in profile.Attributes.Items)
                Attributes.Items.Add(new ProfileAttribute(attribute));            
        }

        public void GetProperties(Profile profile)
        {
            foreach (var property in this.GetType().GetProperties(BindingFlags.Public | BindingFlags.Instance | BindingFlags.DeclaredOnly))
            {
                //skip Attributes
                if (property.Name.Equals("Attributes", StringComparison.OrdinalIgnoreCase))
                    continue;

                object o = property.GetValue(profile);
                if (property.CanWrite)
                    property.SetValue(this, o);
            } 
        }

        public void NotifyPropertyChanged(String property)
        {
            if (PropertyChanged != null)
            {
                PropertyChanged(this, new PropertyChangedEventArgs(property));
            }
        }

        public void NotifyPropertiesChanged()
        {
            if (PropertyChanged == null)
                return;

            foreach (var property in this.GetType().GetProperties(BindingFlags.Public | BindingFlags.Instance | BindingFlags.DeclaredOnly))            
                PropertyChanged(this, new PropertyChangedEventArgs(property.Name));            
        }        
    }

    public class ProfileAttributes
    {
        [XmlElement(ElementName = "Attribute")]
        public ObservableCollection<ProfileAttribute> Items { get; set; }

        public ProfileAttributes()
        {
            Items = new ObservableCollection<ProfileAttribute>();
        }

        public int GetNextId()
        {
            return Items.Count > 0 ? Items.Max(u => u.Id) + 1 : 1;
        }
    }

    public class ProfileAttribute
    {
        private const char UnicodeQuotation = (char)0x201C;

        [XmlElement]
        public int Id { get; set; }

        [XmlElement]
        public string Name { get; set; }

        [XmlElement]
        public string Description { get; set; }

        [XmlElement]
        public int DataType { get; set; }

        [XmlElement]
        public string Rule { get; set; }

        [XmlIgnore]
        public List<ProfileAttributeRuleItem> RuleItems { get; set; }

        public ProfileAttribute() 
        {
            RuleItems = new List<ProfileAttributeRuleItem>();
        }

        //duplicate constructor
        public ProfileAttribute(ProfileAttribute profile)
        {
            RuleItems = new List<ProfileAttributeRuleItem>();

            foreach (var property in this.GetType().GetProperties(BindingFlags.Public | BindingFlags.Instance | BindingFlags.DeclaredOnly))
            {
                //skip Id
                if (property.Name.Equals("Id", StringComparison.OrdinalIgnoreCase))
                    continue;

                //skip RuleItems
                if (property.Name.Equals("RuleItems", StringComparison.OrdinalIgnoreCase))
                    continue;

                object o = property.GetValue(profile);
                if (property.CanWrite)
                    property.SetValue(this, o);
            }              
        }

        public bool VerifyRule(ObservableCollection<TemplateAttribute> templateAttributes, ref string errorMessage, string text, int pass, string splitOperator)
        {
            if (pass == 0)
                RuleItems.Clear();

            if (text == null)
            {
                errorMessage = string.Format("Empty rule item");
                return false;
            }

            try
            {
                //split text by operator char
                string[] array = text.Split(new string[] { splitOperator.ToLower(), splitOperator.ToUpper() }, StringSplitOptions.RemoveEmptyEntries);

                if (pass == 0 && DataType == DataTypes.Bool && array.Length > 1)
                {
                    errorMessage = string.Format("Unknown rule item: +\r\nArithmetic operators are allowed only for numeric data type attributes");
                    return false;                    
                }

                foreach (string s in array)
                {
                    string item = s.Trim();

                    //find attributes
                    foreach (TemplateAttribute attribute in templateAttributes)
                    {
                        if (item.Equals(attribute.Name, StringComparison.OrdinalIgnoreCase))
                        {
                            RuleItems.Add(new ProfileAttributeRuleItem() { Type = ProfileAttributeRuleItem.Types.Attribute, Value = attribute.Name });
                            RuleItems.Add(new ProfileAttributeRuleItem() { Type = ProfileAttributeRuleItem.Types.Operator, Value = splitOperator });
                            item = string.Empty;
                            break;
                        }
                    }

                    //attribute is found
                    if (item.Length == 0)
                        continue;

                    //find Template or Instance property (Id, Name, Description)
                    string[] elements = new string[] { "Template.Id", "Template.Name", "Template.Description", "Instance.Id", "Instance.Name", "Instance.Description", "Instance.Flagged", "Instance.AreaName", "Instance.AreaDescription" };   
                    if (elements.Count(u => u.Equals(item, StringComparison.OrdinalIgnoreCase)) > 0)
                    {
                        if (DataType != DataTypes.String && item.EndsWith("Id", StringComparison.OrdinalIgnoreCase) == false)
                        {
                            if (DataType != DataTypes.Bool && item.EndsWith("Instance.Flagged", StringComparison.OrdinalIgnoreCase) == false)
                            {
                                errorMessage = string.Format("Unknown rule item: {0}\r\nStrings are allowed only for string data type attributes", item);
                                return false;
                            }
                        }
                        
                        RuleItems.Add(new ProfileAttributeRuleItem() { Type = ProfileAttributeRuleItem.Types.TemplateInstanceProperty, Value = item });
                        RuleItems.Add(new ProfileAttributeRuleItem() { Type = ProfileAttributeRuleItem.Types.Operator, Value = splitOperator });
                        item = string.Empty;
                        continue;
                    }

                    //find Client property
                    elements = new string[] { "Client.CompanyName", "Client.ContactName", "Client.Phone", "Client.Email", "Client.Address", "Client.Tax" };
                    if (elements.Count(u => u.Equals(item, StringComparison.OrdinalIgnoreCase)) > 0)
                    {
                        if (DataType != DataTypes.String)
                        {
                            errorMessage = string.Format("Unknown rule item: {0}\r\nStrings are allowed only for string data type attributes", item);
                            return false;
                        }

                        RuleItems.Add(new ProfileAttributeRuleItem() { Type = ProfileAttributeRuleItem.Types.ClientProperty, Value = item });
                        RuleItems.Add(new ProfileAttributeRuleItem() { Type = ProfileAttributeRuleItem.Types.Operator, Value = splitOperator });
                        item = string.Empty;
                        continue;
                    }

                    //find Proposal property
                    elements = new string[] { "Proposal.Name", "Proposal.Description" };
                    if (elements.Count(u => u.Equals(item, StringComparison.OrdinalIgnoreCase)) > 0)
                    {
                        if (DataType != DataTypes.String)
                        {
                            errorMessage = string.Format("Unknown rule item: {0}\r\nStrings are allowed only for string data type attributes", item);
                            return false;
                        }

                        RuleItems.Add(new ProfileAttributeRuleItem() { Type = ProfileAttributeRuleItem.Types.ProposalProperty, Value = item });
                        RuleItems.Add(new ProfileAttributeRuleItem() { Type = ProfileAttributeRuleItem.Types.Operator, Value = splitOperator });
                        item = string.Empty;
                        continue;
                    }

                    //find Company property
                    elements = new string[] { "Company.CompanyName", "Company.ContactName", "Company.Phone", "Company.Email", "Company.Address", "Company.Tax" };
                    if (elements.Count(u => u.Equals(item, StringComparison.OrdinalIgnoreCase)) > 0)
                    {
                        if (DataType != DataTypes.String)
                        {
                            errorMessage = string.Format("Unknown rule item: {0}\r\nStrings are allowed only for string data type attributes", item);
                            return false;
                        }

                        RuleItems.Add(new ProfileAttributeRuleItem() { Type = ProfileAttributeRuleItem.Types.CompanyProperty, Value = item });
                        RuleItems.Add(new ProfileAttributeRuleItem() { Type = ProfileAttributeRuleItem.Types.Operator, Value = splitOperator });
                        item = string.Empty;
                        continue;
                    }                    

                    //find Attribute property (Id, Name, Description, DataType, Value)
                    string[] attrArray = item.Split(new char[] { '.' }, StringSplitOptions.RemoveEmptyEntries);
                    if (attrArray.Length == 2)
                    {
                        var properties = typeof(TemplateAttribute).GetProperties(BindingFlags.Public | BindingFlags.Instance | BindingFlags.DeclaredOnly);
                        if (templateAttributes.Count(u => u.Name.Equals(attrArray[0], StringComparison.OrdinalIgnoreCase)) > 0)
                        {
                            if (properties.Count(u => u.Name.Equals(attrArray[1], StringComparison.OrdinalIgnoreCase)) > 0)
                            {
                                if (DataType != DataTypes.String && attrArray[1].Equals("Id", StringComparison.OrdinalIgnoreCase) == false && attrArray[1].Equals("Value", StringComparison.OrdinalIgnoreCase) == false)
                                {
                                    errorMessage = string.Format("Unknown rule item: {0}\r\nStrings are allowed only for string data type attributes", item);
                                    return false;
                                }

                                RuleItems.Add(new ProfileAttributeRuleItem() { Type = ProfileAttributeRuleItem.Types.AttributeProperty, Value = item });
                                RuleItems.Add(new ProfileAttributeRuleItem() { Type = ProfileAttributeRuleItem.Types.Operator, Value = splitOperator });
                                item = string.Empty;
                                continue;
                            }                            
                        }                        
                    }                    

                    //Attribute property is found
                    if (item.Length == 0)
                        continue;

                    //find strings
                    if ((item.StartsWith("\"") && item.EndsWith("\"")) || (item.StartsWith(UnicodeQuotation.ToString()) && item.EndsWith(UnicodeQuotation.ToString())))
                    {
                        if (DataType != DataTypes.String)
                        {
                            errorMessage = string.Format("Unknown rule item: {0}\r\nStrings are allowed only for string data type attributes", item);
                            return false;
                        }

                        string value = item.TrimStart(new char[] { '"' }).TrimEnd(new char[] { '"' }).TrimStart(new char[] { UnicodeQuotation }).TrimEnd(new char[] { UnicodeQuotation });
                        RuleItems.Add(new ProfileAttributeRuleItem() { Type = ProfileAttributeRuleItem.Types.String, Value = value });
                        RuleItems.Add(new ProfileAttributeRuleItem() { Type = ProfileAttributeRuleItem.Types.Operator, Value = splitOperator });
                        item = string.Empty;
                        continue;
                    }

                    //find numbers
                    if (IsNumeric(item))
                    {
                        if (DataType < DataTypes.Int_8 || DataType > DataTypes.Float)
                        {
                            errorMessage = string.Format("Unknown rule item: {0}\r\nNumbers are allowed only for numeric data type attributes", item);
                            return false;
                        }

                        RuleItems.Add(new ProfileAttributeRuleItem() { Type = ProfileAttributeRuleItem.Types.Number, Value = item });
                        RuleItems.Add(new ProfileAttributeRuleItem() { Type = ProfileAttributeRuleItem.Types.Operator, Value = splitOperator });
                        item = string.Empty;
                        continue;
                    }

                    //find arythmetic operators
                    //pass is used to prevent infinite stack (VerifyRule() recursive call)     
  
                    //subtraction
                    bool? result = CallVerifyRule(templateAttributes, ref errorMessage, item, pass, splitOperator, 1, "-");
                    if (result == true)
                        continue;
                    else if (result == false)
                        return false;                    

                    //division 
                    result = CallVerifyRule(templateAttributes, ref errorMessage, item, pass, splitOperator, 2, "/");
                    if (result == true)
                        continue;
                    else if (result == false)
                        return false;                                        

                    //multiplication
                    result = CallVerifyRule(templateAttributes, ref errorMessage, item, pass, splitOperator, 3, "*");
                    if (result == true)
                        continue;
                    else if (result == false)
                        return false;                                       

                    //find bitwise operators
                    //not
                    if (item.ToUpper().StartsWith("NOT "))
                    {
                        if (DataType != DataTypes.Bool)
                        {
                            errorMessage = string.Format("Unknown rule item: NOT\r\nBitwise operators are allowed only for boolean data type attributes");
                            return false;                            
                        }

                        foreach (TemplateAttribute attribute in templateAttributes)
                        {
                            if (item.Substring(4).Trim().Equals(attribute.Name, StringComparison.OrdinalIgnoreCase))
                            {
                                RuleItems.Add(new ProfileAttributeRuleItem() { Type = ProfileAttributeRuleItem.Types.Operator, Value = "NOT" });
                                RuleItems.Add(new ProfileAttributeRuleItem() { Type = ProfileAttributeRuleItem.Types.Attribute, Value = attribute.Name });
                                RuleItems.Add(new ProfileAttributeRuleItem() { Type = ProfileAttributeRuleItem.Types.Operator, Value = splitOperator });                               
                                item = string.Empty;
                                break;
                            }
                        }

                        if (item.Length == 0)
                            continue;
                    }

                    //and
                    result = CallVerifyRule(templateAttributes, ref errorMessage, item, pass, splitOperator, 4, "AND");
                    if (result == true)
                        continue;
                    else if (result == false)
                        return false;                                                           

                    //xor
                    result = CallVerifyRule(templateAttributes, ref errorMessage, item, pass, splitOperator, 5, "XOR");
                    if (result == true)
                        continue;
                    else if (result == false)
                        return false;

                    //or
                    result = CallVerifyRule(templateAttributes, ref errorMessage, item, pass, splitOperator, 6, "OR");
                    if (result == true)
                        continue;
                    else if (result == false)
                        return false;                    

                    //report error
                    if (item.Length > 0)
                    {
                        errorMessage = string.Format("Unknown rule item: {0}", item);
                        return false;
                    }
                }

                //remove surplus arythmetic operator
                if (RuleItems.Count > 0)
                    RuleItems.RemoveAt(RuleItems.Count - 1);

                return true;
            }
            catch (Exception ex)
            {
                gLog.Error(ex.ToString());
                return false;
            }
        }

        private bool? CallVerifyRule(ObservableCollection<TemplateAttribute> templateAttributes, ref string errorMessage, string item, int pass, string splitOperator, int limitPass, string newSplitOperator)
        {
            if (pass >= limitPass)
                return null;

            try
            {
                if ((DataType < DataTypes.Int_8 || DataType > DataTypes.Float))
                {
                    string[] temp = item.Split(new string[] { splitOperator.ToUpper(), splitOperator.ToLower() }, StringSplitOptions.RemoveEmptyEntries);
                    if (temp.Length > 1)
                    {
                        errorMessage = string.Format("Unknown rule item: {0}\r\nArithmetic operators are allowed only for numeric data type attributes", splitOperator.ToUpper());
                        return false;
                    }
                }

                if (DataType != DataTypes.Bool)
                {
                    string[] temp = item.Split(new string[] { splitOperator.ToUpper(), splitOperator.ToLower() }, StringSplitOptions.RemoveEmptyEntries);
                    if (temp.Length > 1)
                    {
                        errorMessage = string.Format("Unknown rule item: {0}\r\nBitwise operators are allowed only for boolean data type attributes", splitOperator.ToUpper());
                        return false;
                    }
                }

                if (VerifyRule(templateAttributes, ref errorMessage, item, limitPass, newSplitOperator))
                {
                    RuleItems.Add(new ProfileAttributeRuleItem() { Type = ProfileAttributeRuleItem.Types.Operator, Value = splitOperator });
                    item = string.Empty;
                    return true;
                }
                else
                    return false;
            }
            catch (Exception ex)
            {
                gLog.Error(ex.ToString());
                return false;
            }
        }

        public bool IsNumeric(string text)
        {
            double val;

            return Double.TryParse(text, System.Globalization.NumberStyles.Any, System.Globalization.NumberFormatInfo.InvariantInfo, out val);
        }

        /// <summary>
        /// Math operation are made on 2 loop passes
        /// Set IsPrime parameter for multiplication and division rule items
        /// </summary>
        public void SetRuleItemsSignification()
        {
            if (DataType < DataTypes.Int_8 || DataType > DataTypes.Float)
                return;

            for (int i = 0; i < RuleItems.Count; i++)
            {
                //set IsPrime for item and for before and after items
                if (RuleItems[i].Value.Equals("*") || RuleItems[i].Value.Equals("/"))
                {                    
                    if (i - 1 >= 0)
                        RuleItems[i - 1].IsMathPrime = true;

                    RuleItems[i].IsMathPrime = true;

                    if (i + 1 < RuleItems.Count)
                        RuleItems[i + 1].IsMathPrime = true;
                }                
            }
        }
    }

    public class ProfileAttributeRuleItem
    {
        public enum Types
        { 
            Attribute = 1,
            Operator = 2,
            Number = 3,
            String = 4,
            TemplateInstanceProperty = 5,            
            AttributeProperty = 6,
            ClientProperty = 7,
            CompanyProperty = 8,
            ProposalProperty = 9,    
        }

        public Types Type { get; set; }
        public string Value { get; set; }
        public bool IsMathPrime { get; set; } //set if multiplication or division

        public ProfileAttributeRuleItem() { }

        //duplicate constructor
        public ProfileAttributeRuleItem(ProfileAttributeRuleItem item)
        {
            foreach (var property in this.GetType().GetProperties(BindingFlags.Public | BindingFlags.Instance | BindingFlags.DeclaredOnly))
            {                
                object o = property.GetValue(item);
                if (property.CanWrite)
                    property.SetValue(this, o);
            }              
        }
    }

    #endregion

    #region Model

    public class Areas
    {
        [XmlElement(ElementName = "Area")]
        public ObservableCollection<Area> Items { get; set; }

        public Areas()
        {
            Items = new ObservableCollection<Area>();
        }

        public void AddArea(Area area)
        {
            area.Id = GetNextId();
            Items.Add(area);
            area.UpdateLastModification();
        }

        public void AddArea(Area area, int id)
        {
            area.Id = id;
            Items.Add(area);
            area.UpdateLastModification();
        }

        public int GetNextId()
        {
            return Items.Count > 0 ? Items.Max(u => u.Id) + 1 : 1;
        }
    }

    public class Area : INotifyPropertyChanged
    {
        public event PropertyChangedEventHandler PropertyChanged;

        private string _name;

        [XmlElement]
        public int Id { get; set; }

        [XmlElement]
        public string Name
        {
            get
            {
                return _name;
            }
            set
            {
                _name = value;
                NotifyPropertyChanged("Name");
            }
        }

        [XmlElement]
        public string Description
        {
            get;
            set;
        }

        [XmlElement]
        public DateTime LastModification
        {
            get;
            set;
        }

        [XmlIgnore]
        public Instances Instances { get; set; }
        
        private bool _isSelected;
        private bool _isExpanded;
        private bool _isFlaggedHidden;

        [XmlIgnore]
        public bool IsSelected
        {
            get
            {
                return _isSelected;
            }
            set
            {
                _isSelected = value;
                NotifyPropertyChanged("IsSelected");
            }
        }

        [XmlIgnore]
        public bool IsFlaggedHidden
        {
            get
            {
                return _isFlaggedHidden;
            }
            set
            {
                _isFlaggedHidden = value;
                NotifyPropertyChanged("IsFlaggedHidden");
            }
        }

        [XmlIgnore]
        public bool IsExpanded
        {
            get
            {
                return _isExpanded;
            }
            set
            {
                _isExpanded = value;
                NotifyPropertyChanged("IsExpanded");
            }
        }

        public Area()
        {
            Instances = new Instances();            
        }

        //duplicate constructor
        public Area(Area area)
        {
            Name = area.Name;
            Description = area.Description;

            Instances = new Instances();            
        }       

        public void AddInstance(Instance instance)
        {            
            Instances.Items.Add(instance);
            instance.UpdateLastModification();
            UpdateLastModification();
        }

        public void RemoveInstance(Instance instance)
        {
            Instances.Items.Remove(instance);
            UpdateLastModification();
        }        

        public void UpdateLastModification()
        {
            LastModification = DateTime.Now;
        }

        private void NotifyPropertyChanged(String property)
        {
            if (PropertyChanged != null)
            {
                PropertyChanged(this, new PropertyChangedEventArgs(property));
            }
        }
    }

    #endregion

    #region Proposals

    public class Proposal : INotifyPropertyChanged
    {
        public event PropertyChangedEventHandler PropertyChanged;

        private string _folderPath;

        [XmlElement]
        public Topics Topics { get; set; }

        [XmlElement]
        public ProposalClientDetails ClientDetails { get; set; }

        [XmlElement]
        public string FolderPath
        {
            get
            {
                return _folderPath;
            }
            set
            {
                _folderPath = value;
                NotifyPropertyChanged("FolderPath");
            }
        }

        public Proposal() 
        {
            Topics = new Topics();
            ClientDetails = new ProposalClientDetails();
        }

        private void NotifyPropertyChanged(String property)
        {
            if (PropertyChanged != null)
            {
                PropertyChanged(this, new PropertyChangedEventArgs(property));
            }
        }
    }

    public class Topics
    {
        [XmlElement(ElementName = "Topic")]
        public ObservableCollection<Topic> Items { get; set; }

        public Topics()
        {
            Items = new ObservableCollection<Topic>();
        }

        public void AddTopic(Topic topic)
        {
            topic.Id = GetNextId();
            Items.Add(topic);
            topic.UpdateLastModification();
        }

        public void AddOption(Topic topic)
        {
            topic.Id = GetNextOptionId();
            topic.IsOption = true;
            Items.Add(topic);
            topic.UpdateLastModification();
        }

        public int GetNextId()
        {
            return Items.Where(u => u.IsOption == false).Count() > 0 ? Items.Where(u => u.IsOption == false).Max(u => u.Id) + 1 : 1;
        }

        public int GetNextOptionId()
        {
            return Items.Where(u => u.IsOption == true).Count() > 0 ? Items.Where(u => u.IsOption == true).Max(u => u.Id) + 1 : 10001;
        }
    }

    public class Topic : INotifyPropertyChanged
    {
        public event PropertyChangedEventHandler PropertyChanged;

        private string _name;

        [XmlElement]
        public int Id { get; set; }

        [XmlElement]
        public string Name
        {
            get
            {
                return _name;
            }
            set
            {
                _name = value;
                NotifyPropertyChanged("Name");
            }
        }

        [XmlElement]
        public string Description
        {
            get;
            set;
        }

        [XmlElement]
        public bool IsOption
        {
            get;
            set;
        }

        [XmlElement]
        public DateTime LastModification
        {
            get;
            set;
        }
        
        [XmlElement]
        public ProposalItems ProposalItems { get; set; }        

        private bool _isSelected;
        private bool _isExpanded;
        private bool _isFlaggedHidden;

        [XmlIgnore]
        public bool IsSelected
        {
            get
            {
                return _isSelected;
            }
            set
            {
                _isSelected = value;
                NotifyPropertyChanged("IsSelected");
            }
        }

        [XmlIgnore]
        public bool IsFlaggedHidden
        {
            get
            {
                return _isFlaggedHidden;
            }
            set
            {
                _isFlaggedHidden = value;
                NotifyPropertyChanged("IsFlaggedHidden");
            }
        }

        [XmlIgnore]
        public bool IsExpanded
        {
            get
            {
                return _isExpanded;
            }
            set
            {
                _isExpanded = value;
                NotifyPropertyChanged("IsExpanded");
            }
        }

        public Topic()
        {
            ProposalItems = new ProposalItems();            
        }

        //duplicate constructor
        public Topic(Topic topic)
        {
            Name = topic.Name;
            Description = topic.Description;
            IsOption = topic.IsOption;

            ProposalItems = new ProposalItems();
                        
            foreach (ProposalItem item in topic.ProposalItems.Items)
                AddProposalItem(new ProposalItem(item));            
        }

        public void AddProposalItem(ProposalItem item)
        {
            item.Id = ProposalItems.GetNextId();
            ProposalItems.Items.Add(item);
            item.UpdateLastModification();
            UpdateLastModification();
        }

        public void RemoveProposalItem(ProposalItem item)
        {
            ProposalItems.Items.Remove(item);
            UpdateLastModification();
        }       

        public void UpdateLastModification()
        {
            LastModification = DateTime.Now;
        }

        private void NotifyPropertyChanged(String property)
        {
            if (PropertyChanged != null)
            {
                PropertyChanged(this, new PropertyChangedEventArgs(property));
            }
        }
    }

    public class ProposalItems
    {
        [XmlElement(ElementName = "ProposalItem")]
        public ObservableCollection<ProposalItem> Items { get; set; }

        public ProposalItems()
        {
            Items = new ObservableCollection<ProposalItem>();
        }

        public int GetNextId()
        {
            return Items.Count > 0 ? Items.Max(u => u.Id) + 1 : 1;
        }
    }

    public class ProposalItem : INotifyPropertyChanged
    {
        public event PropertyChangedEventHandler PropertyChanged;

        private string _name;

        [XmlElement]
        public int Id { get; set; }

        [XmlElement]
        public string Name
        {
            get
            {
                return _name;
            }
            set
            {
                _name = value;
                NotifyPropertyChanged("Name");
            }
        }

        [XmlElement]
        public string Description { get; set; }

        [XmlElement]
        public DateTime LastModification
        {
            get;
            set;
        }

        [XmlElement]
        public ProposalAttributes Attributes { get; set; }

        private bool _isSelected;
        private bool _isExpanded;
        private bool _isFlagged;
        private bool _isFlaggedHidden;

        [XmlIgnore]
        public bool IsSelected
        {
            get
            {
                return _isSelected;
            }
            set
            {
                _isSelected = value;
                NotifyPropertyChanged("IsSelected");
            }
        }

        [XmlIgnore]
        public bool IsExpanded
        {
            get
            {
                return _isExpanded;
            }
            set
            {
                _isExpanded = value;
                NotifyPropertyChanged("IsExpanded");
            }
        }

        [XmlElement]
        public bool IsFlagged
        {
            get
            {
                return _isFlagged;
            }
            set
            {
                _isFlagged = value;
                NotifyPropertyChanged("IsFlagged");
            }
        }

        [XmlIgnore]
        public bool IsFlaggedHidden
        {
            get
            {
                return _isFlaggedHidden;
            }
            set
            {
                _isFlaggedHidden = value;
                NotifyPropertyChanged("IsFlaggedHidden");
            }
        }

        public ProposalItem()
        {
            Attributes = new ProposalAttributes();
        }

        //duplicate constructor
        public ProposalItem(ProposalItem item)
        {
            Name = item.Name;
            Description = item.Description;

            Attributes = new ProposalAttributes();
            foreach (ProposalAttribute attribute in item.Attributes.Items)
                AddAttribute(new ProposalAttribute(attribute));
        }

        //create from string constructor
        //public Instance(int[] ids, string line)
        //{
        //    string[] values = line.Split(new char[] { ',' }, StringSplitOptions.RemoveEmptyEntries);
        //    Name = values[0].Equals("NULL", StringComparison.OrdinalIgnoreCase) ? string.Empty : values[0];
        //    Description = values[1].Equals("NULL", StringComparison.OrdinalIgnoreCase) ? string.Empty : values[1];

        //    Attributes = new InstanceAttributes();
        //    for (int i = 2; i < values.Length; i++)
        //        AddAttribute(new InstanceAttribute() { Id = ids[i], Value = values[i] });
        //}

        public void AddAttribute(ProposalAttribute attribute)
        {
            Attributes.Items.Add(attribute);
            UpdateLastModification();
        }

        public void RemoveAttribute(ProposalAttribute attribute)
        {
            Attributes.Items.Remove(attribute);
            UpdateLastModification();
        }

        public void UpdateLastModification()
        {
            LastModification = DateTime.Now;
        }

        private void NotifyPropertyChanged(String property)
        {
            if (PropertyChanged != null)
            {
                PropertyChanged(this, new PropertyChangedEventArgs(property));
            }
        }
    }

    public class ProposalAttributes
    {
        [XmlElement(ElementName = "Attribute")]
        public ObservableCollection<ProposalAttribute> Items { get; set; }

        public ProposalAttributes()
        {
            Items = new ObservableCollection<ProposalAttribute>();
        }

        public int GetNextId()
        {
            return Items.Count > 0 ? Items.Max(u => u.Id) + 1 : 1;
        }
    }

    public class ProposalAttribute : INotifyPropertyChanged
    {
        public event PropertyChangedEventHandler PropertyChanged;

        private int _quantity;
        private decimal _price;
        private decimal _margin;

        [XmlElement]
        public int Id { get; set; }

        [XmlElement]
        public string Supplier { get; set; }

        [XmlElement]
        public string Code { get; set; }

        [XmlElement]
        public string Description { get; set; }

        [XmlElement]
        public int Quantity 
        {
            get
            {
                return _quantity;
            }
            set
            {
                _quantity = value;
                NotifyPropertyChanged("Quantity");
                NotifyPropertyChanged("MarginPrice");
                NotifyPropertyChanged("TotalCost");
            }
        }    

        [XmlElement]
        public decimal Price
        {
            get
            {
                return _price;
            }
            set
            {
                _price = value;
                NotifyPropertyChanged("Price");
                NotifyPropertyChanged("MarginPrice");
                NotifyPropertyChanged("TotalCost");
            }
        }

        [XmlElement]
        public decimal Margin
        {
            get
            {
                return _margin;
            }
            set
            {
                _margin = value;
                NotifyPropertyChanged("Margin");
                NotifyPropertyChanged("MarginPrice");
                NotifyPropertyChanged("TotalCost");
            }
        }

        [XmlIgnore]
        public decimal MarginPrice 
        {
            get
            {
                return Quantity * Price * (Margin / 100);
            }
        }

        [XmlIgnore]
        public decimal TotalCost
        {
            get
            {
                return (Quantity * Price) + MarginPrice;
            }
        }

        public ProposalAttribute() { }

        //duplicate constructor
        public ProposalAttribute(ProposalAttribute attribute)
        {
            foreach (var property in this.GetType().GetProperties(BindingFlags.Public | BindingFlags.Instance | BindingFlags.DeclaredOnly))
            {
                //skip Id
                if (property.Name.Equals("id", StringComparison.OrdinalIgnoreCase))
                    continue;

                object o = property.GetValue(attribute);
                if (property.CanWrite)
                    property.SetValue(this, o);
            }
        }

        private void NotifyPropertyChanged(String property)
        {
            if (PropertyChanged != null)
            {
                PropertyChanged(this, new PropertyChangedEventArgs(property));
            }
        }
    }

    public class ProposalClientDetails : INotifyPropertyChanged
    {
        public event PropertyChangedEventHandler PropertyChanged;
       
        private string _name;
        private string _description;
        private string _companyName;
        private string _contactName;
        private string _phoneNumber;
        private string _emailAddress;
        private string _address;
        private string _taxNumber;
        private string _logoFilePath;

        [XmlElement]
        public string Name 
        {
            get
            {
                return _name;
            }
            set
            {
                _name = value;
                NotifyPropertyChanged("Name");
            }
        }

        [XmlElement]
        public string Description
        {
            get
            {
                return _description;
            }
            set
            {
                _description = value;
                NotifyPropertyChanged("Description");
            }
        }

        [XmlElement]
        public string CompanyName
        {
            get
            {
                return _companyName;
            }
            set
            {
                _companyName = value;
                NotifyPropertyChanged("CompanyName");
            }
        }

        [XmlElement]
        public string ContactName
        {
            get
            {
                return _contactName;
            }
            set
            {
                _contactName = value;
                NotifyPropertyChanged("ContactName");
            }
        }

        [XmlElement]
        public string PhoneNumber
        {
            get
            {
                return _phoneNumber;
            }
            set
            {
                _phoneNumber = value;
                NotifyPropertyChanged("PhoneNumber");
            }
        }

        [XmlElement]
        public string EmailAddress
        {
            get
            {
                return _emailAddress;
            }
            set
            {
                _emailAddress = value;
                NotifyPropertyChanged("EmailAddress");
            }
        }

        [XmlElement]
        public string Address
        {
            get
            {
                return _address;
            }
            set
            {
                _address = value;
                NotifyPropertyChanged("Address");
            }
        }


        [XmlElement]
        public string TaxNumber
        {
            get
            {
                return _taxNumber;
            }
            set
            {
                _taxNumber = value;
                NotifyPropertyChanged("TaxNumber");
            }
        }

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
        public DateTime LastModification { get; set; }       

        public ProposalClientDetails() { }        

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

    #endregion
}

