using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Data;
using System.Windows.Documents;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using System.Windows.Shapes;
using gTools.Log;
using System.Collections.ObjectModel;
using MyControls;

namespace TagCreator
{
    /// <summary>
    /// Interaction logic for ProfileAttributeWindow.xaml
    /// </summary>
    public partial class ProfileAttributeWindow : WindowBase, INotifyPropertyChanged
    {
        #region Initialization

        private ProfileAttribute _currentAttribute;
        private int _currentInputAttributeId;

        public ProfileAttributeWindow()
        {
            InitializeComponent();
            this.DataContext = this;

            // Ensure DataTypes is loaded from ParentProxy (added logic)
            if (ParentProxy != null)
            {
                NotifyPropertyChanged("ParentProxy.DataTypes");
            }
        }

        #endregion

        #region Properties

        public EngineeringParentProxy ParentProxy
        {
            get;
            set;
        }

        public MainWindow MainWindow
        {
            get;
            set;
        }

        #endregion

        #region Data Binding

        public ProfileAttribute CurrentAttribute
        {
            get
            {
                return _currentAttribute;
            }
            set
            {
                _currentAttribute = value;
                NotifyPropertyChanged("CurrentAttribute");
                NotifyPropertyChanged("IsCurrentAttribute");
                NotifyPropertyChanged("IsFirstItem");
                NotifyPropertyChanged("IsLastItem");
            }
        }

        public bool IsCurrentAttribute
        {
            get
            {
                return _currentAttribute != null;
            }
        }

        public bool IsFirstItem
        {
            get
            {
                int index = ParentProxy.CurrentProfile.Attributes.Items.IndexOf(_currentAttribute);
                return (index > 0);
            }
        }

        public bool IsLastItem
        {
            get
            {
                int index = ParentProxy.CurrentProfile.Attributes.Items.IndexOf(_currentAttribute);
                return (index < ParentProxy.CurrentProfile.Attributes.Items.Count - 1);
            }
        }

        public bool IsRule
        {
            get
            {
                return !string.IsNullOrEmpty(_currentAttribute.Rule);
            }
        }

        public int CurrentInputAttributeId
        {
            get
            {
                return _currentInputAttributeId;
            }
            set
            {
                _currentInputAttributeId = value;
                NotifyPropertyChanged("CurrentInputAttributeId");
                NotifyPropertyChanged("IsCurrentInputAttribute");
            }
        }

        public bool IsCurrentInputAttribute
        {
            get
            {
                return _currentAttribute != null && _currentInputAttributeId > 0;
            }
        }

        #endregion

        #region Events

        private void PreviousButton_Click(object sender, RoutedEventArgs e)
        {
            try
            {
                int index = ParentProxy.CurrentProfile.Attributes.Items.IndexOf(_currentAttribute) - 1;

                if (index >= 0)
                    CurrentAttribute = ParentProxy.CurrentProfile.Attributes.Items[index];
            }
            catch (Exception ex)
            {
                gLog.Error(ex.ToString());
            }
        }

        private void NextButton_Click(object sender, RoutedEventArgs e)
        {
            try
            {
                int index = ParentProxy.CurrentProfile.Attributes.Items.IndexOf(_currentAttribute) + 1;

                if (index >= 0)
                    CurrentAttribute = ParentProxy.CurrentProfile.Attributes.Items[index];
            }
            catch (Exception ex)
            {
                gLog.Error(ex.ToString());
            }
        }

        private void AddAttributeButton_Click(object sender, RoutedEventArgs e)
        {
            try
            {
                ProfileAttribute attribute = new ProfileAttribute();
                attribute.Id = ParentProxy.CurrentProfile.Attributes.GetNextId();
                ParentProxy.CurrentTemplate.AddProfileAttribute(ParentProxy.CurrentProfile, attribute);

                CurrentAttribute = attribute;
                _nameTextBox.Focus();
            }
            catch (Exception ex)
            {
                gLog.Error(ex.ToString());
            }
        }

        private void DeleteAttributeButton_Click(object sender, RoutedEventArgs e)
        {
            try
            {
                if (MainWindow.Confirm("Are you sure that you want to delete attribute {0}?", _currentAttribute.Name) != true)
                    return;

                // Get the index of the current attribute
                int index = ParentProxy.CurrentProfile.Attributes.Items.IndexOf(_currentAttribute);

                // Remove the current attribute
                ParentProxy.CurrentTemplate.RemoveProfileAttribute(ParentProxy.CurrentProfile, _currentAttribute);

                // Reassign IDs to the remaining attributes
                ReassignIds();

                // Update the current attribute to the previous one or first one if the deleted one was the last
                if (index >= 0 && ParentProxy.CurrentProfile.Attributes.Items.Count > 0)
                    CurrentAttribute = ParentProxy.CurrentProfile.Attributes.Items[Math.Max(index - 1, 0)];
                else
                    CurrentAttribute = null;
            }
            catch (Exception ex)
            {
                gLog.Error(ex.ToString());
            }
        }

        private void ReassignIds()
        {
            var attributes = ParentProxy.CurrentProfile.Attributes.Items;

            for (int i = 0; i < attributes.Count; i++)
            {
                attributes[i].Id = i + 1;
            }
        }

        private void DuplicateAttributeButton_Click(object sender, RoutedEventArgs e)
        {
            try
            {
                // Copy attribute's properties
                ProfileAttribute attribute = new ProfileAttribute(_currentAttribute)
                {
                    Id = ParentProxy.CurrentProfile.Attributes.GetNextId()
                };
                ParentProxy.CurrentTemplate.AddProfileAttribute(ParentProxy.CurrentProfile, attribute);

                CurrentAttribute = attribute;
                _nameTextBox.Focus();
                _nameTextBox.SelectAll();
            }
            catch (Exception ex)
            {
                gLog.Error(ex.ToString());
            }
        }

        private void InsertAttributeButton_Click(object sender, RoutedEventArgs e)
        {
            string attribute = ParentProxy.CurrentTemplate.Attributes.Items
                .Where(u => u.Id == _currentInputAttributeId).Single().Name;

            _currentAttribute.Rule = string.IsNullOrEmpty(_currentAttribute.Rule)
                ? string.Empty
                : _currentAttribute.Rule.TrimEnd();

            // Check if an operator is needed
            bool addOperator = !string.IsNullOrEmpty(_currentAttribute.Rule);
            if (addOperator)
            {
                string[] operators = { "+", "-", "/", "*", "and", "or", "not" };
                addOperator = !operators.Any(op => _currentAttribute.Rule.ToLower().EndsWith(op));
            }

            _currentAttribute.Rule += addOperator
                ? (_currentAttribute.DataType == DataTypes.Bool ? " OR " + attribute : " + " + attribute)
                : (string.IsNullOrEmpty(_currentAttribute.Rule) ? attribute : " " + attribute);

            CurrentInputAttributeId = 0;
            NotifyPropertyChanged("CurrentAttribute");
        }

        private void VerifyRuleButton_Click(object sender, RoutedEventArgs e)
        {
            string errorMessage = string.Empty;

            if (_currentAttribute.VerifyRule(ParentProxy.CurrentTemplate.Attributes.Items, ref errorMessage, _currentAttribute.Rule, 0, "+"))
                MainWindow.ShowAutoMessage(1500, "Rule verification succeeded");
            else
                MainWindow.ShowMessage(errorMessage);
        }

        private void _ruleTextBox_TextChanged(object sender, TextChangedEventArgs e)
        {
            NotifyPropertyChanged("IsRule");
        }

        #endregion

        #region INotifyPropertyChanged Implementation

        public event PropertyChangedEventHandler PropertyChanged;

        public void NotifyPropertyChanged(string propertyName)
        {
            PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(propertyName));
        }

        #endregion
    }
}
