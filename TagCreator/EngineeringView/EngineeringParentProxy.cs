using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace TagCreator
{
    public class EngineeringParentProxy : INotifyPropertyChanged
    {
        #region Initialization

        public event PropertyChangedEventHandler PropertyChanged;
        
        #endregion

        #region Properties
        
        public EngineeringViewControl EngineeringViewControl
        {
            get;
            set;
        }

        public ModelViewControl ModelViewControl
        {
            get;
            set;
        }

        public Project Project
        {
            get
            {
                if (EngineeringViewControl != null)
                    return EngineeringViewControl.Project;

                if (ModelViewControl != null)
                    return ModelViewControl.Project;

                return null;
            }
        }

        public Template CurrentTemplate
        {
            get
            {
                if (EngineeringViewControl != null)
                    return EngineeringViewControl.CurrentTemplate;

                if (ModelViewControl != null)
                    return ModelViewControl.CurrentTemplate;

                return null;
            }
        }

        public Area CurrentArea
        {
            get
            {
                if (EngineeringViewControl != null)
                    return null;

                if (ModelViewControl != null)
                    return ModelViewControl.CurrentArea;

                return null;
            }   
        }

        public Instance CurrentInstance
        {
            get
            {
                if (EngineeringViewControl != null)
                    return EngineeringViewControl.CurrentInstance;

                if (ModelViewControl != null)
                    return ModelViewControl.CurrentInstance;

                return null;
            }   
        }

        public Profile CurrentProfile
        {
            get
            {
                if (EngineeringViewControl != null)
                    return EngineeringViewControl.CurrentProfile;

                if (ModelViewControl != null)
                    return ModelViewControl.CurrentProfile;

                return null;
            }
        }

        public DataTypes DataTypes
        {
            get
            {
                return App.DataTypes;
            }
        }

        #endregion

        #region Data Binding

        public string TemplateName
        {
            get
            {
                if (EngineeringViewControl != null)
                    return EngineeringViewControl.TemplateName;

                if (ModelViewControl != null)
                    return ModelViewControl.TemplateName;

                return string.Empty;
            }            
        }

        public string TemplateDescription
        {
            get
            {
                if (EngineeringViewControl != null)
                    return EngineeringViewControl.TemplateDescription;

                if (ModelViewControl != null)
                    return ModelViewControl.TemplateDescription;

                return string.Empty;
            }
            set
            {
                if (EngineeringViewControl != null)
                    EngineeringViewControl.TemplateDescription = value;

                if (ModelViewControl != null)
                    ModelViewControl.TemplateDescription = value;
            }
        }

        public string TemplateLastModification
        {
            get
            {
                if (EngineeringViewControl != null)
                    return EngineeringViewControl.TemplateLastModification;

                if (ModelViewControl != null)
                    return ModelViewControl.TemplateLastModification;

                return string.Empty;
            }
        }       

        public bool IsUserAreaSelected
        {
            get
            {
                if (ModelViewControl != null)
                    return ModelViewControl.IsUserAreaSelected;

                return false;
            }
        }

        public bool IsTemplateSelected
        {
            get
            {
                if (EngineeringViewControl != null)
                    return EngineeringViewControl.IsTemplateSelected;

                return false;
            }
        }

        public bool IsInstanceSelected
        {
            get
            {
                if (EngineeringViewControl != null)
                    return EngineeringViewControl.IsInstanceSelected;

                if (ModelViewControl != null)
                    return ModelViewControl.IsInstanceSelected;

                return false;
            }           
        }

        #endregion

        #region Methods

        /// <summary>
        /// WPF data change notification
        /// </summary>
        /// <param name="property"></param>
        public void NotifyPropertyChanged(String property)
        {
            if (PropertyChanged != null)
            {
                PropertyChanged(this, new PropertyChangedEventArgs(property));
            }

            if (EngineeringViewControl != null)
                EngineeringViewControl.NotifyPropertyChanged(property);

            if (ModelViewControl != null)
                ModelViewControl.NotifyPropertyChanged(property);
        }

        public int GetAttributeIndex(AttributeBase attribute)
        {
            if (EngineeringViewControl != null)
                return EngineeringViewControl.GetAttributeIndex(attribute);

            if (ModelViewControl != null)
                return ModelViewControl.GetAttributeIndex(attribute);

            return -1;
        }

        public void ExportProfile(Profile profile)
        {
            if (EngineeringViewControl != null)
                EngineeringViewControl.ExportProfile(profile);

            if (ModelViewControl != null)
                ModelViewControl.ExportProfile(profile);
        }

        #endregion   

    }
}
